// エディタのアンドゥ・リドゥのテストを目的としたプログラム
// 
// バージョン : 1.06
// 制作者　　 : wolfeign(@wolfeign)
// 公開日　　 : 2022/08/26(Fri)
// 更新日　　 : 2022/10/22(Sat)
// ライセンス : MITライセンス

// 【バージョン履歴】
// 
// 1.00 [2022/08/26(Fri)] - 公開
// 
// 
// 1.01 [2022/08/29(Mon)] - バグ修正
// 
//  ・IME入力時にリドゥ可能だった場合、正しくアンドゥできないバグを修正
//  ・日本語のアンドゥ名を得られるようにした
//  ・リサイズ時のカーソル変更をクラスではなくカスタムプロパティにした
// 
// 
// 1.02 [2022/08/31(Wed)] - 微修正
// 
//  ・エディタの選択範囲が空かどうかの判定に自分のコードではなくRangeのcollapsedを使用するようにした
//  ・そのため SelectionRange.isSelectNone()は不要に
// 
// 
// 1.03 [2022/09/01(Thu)] - 微修正
// 
//  ・dragendイベントをdropendと記述ミスしていたのを修正
//  ・画像をクリックしたときカーソルを掴む形状にした
//  ・要素をつかんでいる間はキー入力を無視するようにした
//
//  ・キャレットが行頭にある場合 Editor.getRangeRect()が正常な値を返さないことがあるため修正
// 
// 
// 1.04 [2022/09/03(Sat)] - 自動スクロールと大幅修正
// 
//  ・画像およびテーブルをリサイズ中にマウスが画面外に出た場合、一定間隔で自動スクロールするようにした
//  ・新たにResizeUndoItemクラスを作成。UndoItemの派生クラスで、リサイズのアンドゥ・リドゥを担当する
//  ・UndoItemクラスとMutationItemにundo()とredo()のメソッドを実装
//  ・リサイズ中に右クリックメニューを表示した場合リサイズを中断するようにした
//  ・Editorに3種類の定数を追加
// 
// 
// 1.05 [2022/09/17(Sat)] - バグ修正
// 
//  ・Ctrl+Vによる貼り付けとCtrl+Xによる切り取りの際にアンドゥをリセットするようにした
//  ・カーソルキーの入力時にアンドゥをリセットするようにした
// 
// 
// 1.06 [2022/10/22(Sat)] - バグ修正
// 
//  ・BSキーを入力した際 選択範囲の変更イベントが発生しない為、自発的に発生させるようにした



// 選択範囲
// getSelection()で得られる値とは別のものなので要注意
class SelectionRange {
    constructor(startContainer, startOffset, endContainer, endOffset) {
        // 選択開始位置を含むノード
        this.startContainer = startContainer;
        // 選択開始位置
        this.startOffset = startOffset;

        // 選択終了位置を含むノード
        this.endContainer = endContainer;
        // 選択終了位置
        this.endOffset = endOffset;
    }

    // 同じ選択範囲かどうか
    isSameSelection(selection) {
        if (!selection)
            return false;

        if (this.startContainer !== selection.startContainer || this.startOffset !== selection.startOffset)
            return false;
        else if (this.endContainer !== selection.endContainer || this.endOffset !== selection.endOffset)
            return false;

        return true;
    }
}

// 変更アイテム
class MutationItem {
    constructor(mutations, selection) {
        // 変更
        this.mutations = mutations;

        // 選択範囲
        this.selection = selection;
    }

    // アンドゥ
    undo(iframe) {
        if (this.mutations) {
            const mutations = this.mutations.slice();

            mutations.reverse();
            this.undoMutations(mutations);
        }

        Editor.setSelection(iframe, this.selection);
    }

    // 変更をアンドゥ
    undoMutations(mutations) {
        for (let mutation of mutations) {
            const type = mutation.type.toLowerCase();

            if ("characterdata" === type) {
                if (mutation.target)
                    mutation.target.textContent = mutation._oldValue;
            } else if ("childlist" === type) {
                const nodes1 = Array.from(mutation.addedNodes).slice();
                nodes1.reverse();

                for (let node of nodes1) {
                    node.remove();
                }

                const nodes2 = Array.from(mutation.removedNodes).slice();
                nodes2.reverse();

                for (let node of nodes2) {
                    if (mutation.target) {
                        if (mutation.previousSibling) {
                            let parent = null;
                            if (mutation.previousSibling.nextSibling)
                                parent = mutation.previousSibling.nextSibling.parentNode;
                            else
                                parent = mutation.previousSibling.parentNode;

                            if (parent)
                                parent.insertBefore(node, mutation.previousSibling.nextSibling);
                        } else if (mutation.nextSibling) {
                            if (mutation.nextSibling.parentNode)
                                mutation.nextSibling.parentNode.insertBefore(node, mutation.nextSibling);
                        } else
                            mutation.target.appendChild(node);
                    }
                }
            } else if ("attributes" === type) {
                if (mutation.target) {
                    if (mutation.oldValue)
                        mutation.target.setAttribute(mutation.attributeName, mutation.oldValue);
                    else
                        mutation.target.removeAttribute(mutation.attributeName);
                }
            }
        }
    }

    // リドゥ
    redo(iframe) {
        Editor.setSelection(iframe, this.selection);

        if (this.mutations)
            this.redoMutations(this.mutations);
    }

    // 変更をリドゥ
    redoMutations(mutations) {
        for (let mutation of mutations) {
            const type = mutation.type.toLowerCase();

            if ("characterdata" === type) {
                if (mutation.target)
                    mutation.target.textContent = mutation._currentValue;
            } else if ("childlist" === type) {
                for (let node of mutation.removedNodes) {
                    node.remove();
                }

                for (let node of mutation.addedNodes) {
                    if (mutation.target) {
                        if (mutation.previousSibling) {
                            let parent = null;
                            if (mutation.previousSibling.nextSibling)
                                parent = mutation.previousSibling.nextSibling.parentNode;
                            else
                                parent = mutation.previousSibling.parentNode;

                            if (parent)
                                parent.insertBefore(node, mutation.previousSibling.nextSibling);
                        } else if (mutation.nextSibling) {
                            if (mutation.nextSibling.parentNode)
                                mutation.nextSibling.parentNode.insertBefore(node, mutation.nextSibling);
                        } else
                            mutation.target.appendChild(node);
                    }
                }
            } else if ("attributes" === type) {
                if (mutation.target) {
                    if (mutation._currentValue)
                        mutation.target.setAttribute(mutation.attributeName, mutation._currentValue);
                    else
                        mutation.target.removeAttribute(mutation.attributeName);
                }
            }
        }
    }
}

// アンドゥアイテム
class UndoItem {
    constructor(type) {
        // タイプ
        this.type = type;

        // MutationItemのリスト
        this.mutationList = [];
    }

    // 新規MutationItemを追加
    pushMutation(mutations, selection) {
        this.mutationList.push(new MutationItem(mutations, selection));
    }

    // アンドゥ
    undo(iframe) {
        for (let i = this.mutationList.length - 1; i >= 0; i--) {
            this.mutationList[i].undo(iframe);
        }
    }

    // リドゥ
    redo(iframe) {
        for (let item of this.mutationList) {
            item.redo(iframe);
        }
    }
}

// リサイズアンドゥ
class ResizeUndoItem extends UndoItem {
    constructor(type, element, style, selection) {
        super(type);

        // 要素
        this.element = element;

        // 初期のスタイル(nullの可能性もある)
        this.firstStyle = style;

        // 現在のスタイル
        this.style = null;

        // 選択範囲
        this.selection = selection;
    }

    // アンドゥ
    undo(iframe) {
        Editor.setElementStyle(this.element, this.firstStyle);
        Editor.setSelection(iframe, this.selection);
    }

    // リドゥ
    redo(iframe) {
        Editor.setSelection(iframe, this.selection);
        Editor.setElementStyle(this.element, this.style);
    }

    // リサイズされたときに呼び出される
    onResize() {
        this.style = this.element.getAttribute("style");
    }
}

// エディタクラス
class Editor {
    // 要素の最小サイズ
    static get ELEMENT_MIN_SIZE() {
        return 10;
    }

    // 自動スクロールの間隔
    static get AUTO_SCROLL_INTERVAL() {
        return 15;
    }

    // 自動スクロールの速さ(小数可)
    static get AUTO_SCROLL_SPEED() {
        return 0.5;
    }

    constructor() {
        this.iframe = null;
        this.container = null;
        this.editor = null;
        // 操作ハンドル
        this.handle = null;

        // 選択範囲（SelectionRangeクラス）
        this.selection = null;

        // 選択中の要素
        this.selectedElement = null;
        // つかんでいる要素
        this.grabbingElement = null;
        // つかんでいるハンドル
        this.grabbingHandle = null;
        // つかんだ位置
        this.grabbingFirstX = 0;
        this.grabbingFirstY = 0;
        // つかんだ要素の位置とサイズ
        this.grabbingFirstLeft = 0;
        this.grabbingFirstTop = 0;
        this.grabbingFirstWidth = 0;
        this.grabbingFirstHeight = 0;
        // つかんだときのスクロール位置
        this.grabbingFirstScrollLeft = 0;
        this.grabbingFirstScrollTop = 0;
        // つかんでいる間のタイマー
        this.grabbingTimer = null;
        // つかんでいる間のマウスカーソルの位置
        this.grabbingCursorX = 0;
        this.grabbingCursorY = 0;

        // 入力タイプ
        this.inputType = "";
        // ユーザーにより入力されたか
        this.inputByUser = false;

        // IME入力開始直後かどうか
        this.isFirstIme = false;
        // IME入力中のUndoItem
        this.imeUndoItem = null;

        // UndoItemのリスト
        this.undoList = [];
        // アンドゥの位置
        this.undoPosition = 0;
        // アンドゥを新たなアイテムとして記録するか
        this.isFirstUndo = true;
        // 1回だけ変更を無視するか
        this.isIgnoreModify = false;
    }

    // iframeを記憶し、各種初期化を行う
    setFrame(iframe) {
        this.iframe = iframe;
        this.container = null;
        this.editor = null;
        this.handle = null;

        if (!iframe)
            return;

        this.container = iframe.contentDocument.getElementById("container");
        this.editor = iframe.contentDocument.getElementById("editor");
        this.handle = iframe.contentDocument.getElementById("handle");

        if (!this.container || !this.editor || !this.handle)
            return;

        // CSSを使用する
        iframe.contentDocument.execCommand("styleWithCSS", false, true);

        // スクロールイベント
        this.container.addEventListener("scroll", () => {
            this.setHandleRect(this.selectedElement);
        }, false);

        // エディタのサイズ変更を監視
        new ResizeObserver(() => {
            this.setHandleRect(this.selectedElement);
        }).observe(this.editor);

        // キーの押下
        iframe.contentWindow.addEventListener("keydown", (event) => {
            // 要素をつかんでいる間はキー入力を無視する
            if (this.isGrabbing()) {
                event.preventDefault();
                event.stopPropagation();
                return false;
            }

            const key = event.key.toLowerCase();
            if ("z" === key) {
                if (event.ctrlKey && !event.shiftKey && !event.altKey) {
                    event.preventDefault();
                    this.undo();
                    return false;
                }
            } else if ("y" === key) {
                if (event.ctrlKey && !event.shiftKey && !event.altKey) {
                    event.preventDefault();
                    this.redo();
                    return false;
                }
            } else if ("arrowleft" === key || "arrowright" === key || "arrowup" === key || "arrowdown" === key)
                this.resetUndo();
        }, false);

        // マウスが押されたとき
        iframe.contentWindow.addEventListener("mousedown", (event) => {
            const element = iframe.contentDocument.elementFromPoint(event.pageX, event.pageY);

            if (element && element.tagName) {
                if ("img" === element.tagName.toLowerCase()) {
                    if (0 === event.button || 2 === event.button) {
                        // 画像のみを選択
                        this.selectImage(element);

                        this.iframe.contentDocument.body.classList.add("single-image-select");
                        this.iframe.contentDocument.documentElement.style.setProperty("--editor-image-cursor", "grabbing");
                        this.ignoreModify();
                    }
                }
            }
        }, false);

        // マウスが離されたとき
        iframe.contentWindow.addEventListener("mouseup", (event) => {
            if (this.releaseGrabbing())
                this.resetUndo();
        });

        // マウスが離されたとき
        document.addEventListener("mouseup", (event) => {
            if (this.releaseGrabbing())
                this.resetUndo();
        });

        // マウスが移動したとき
        function onMouseMove(editor, event, offsetX, offsetY) {
            if (0 === event.buttons & 1) {
                if (editor.releaseGrabbing())
                    editor.resetUndo();

                return false;
            }

            if (editor.isGrabbing()) {
                const x = event.pageX - offsetX;
                const y = event.pageY - offsetY;

                editor.doResize(x + editor.container.scrollLeft - editor.grabbingFirstScrollLeft, y + editor.container.scrollTop - editor.grabbingFirstScrollTop);

                return true;
            }

            return false;
        }

        // iframe外のマウス移動を捉える
        document.addEventListener("mousemove", () => {
            if (this.isGrabbing()) {
                const rect = iframe.getBoundingClientRect();

                this.grabbingCursorX = event.pageX;
                this.grabbingCursorY = event.pageY;

                if (onMouseMove(this, event, rect.left, rect.top)) {
                    // 要素をつかんでいるときにマウスがエディタ外に出た場合の自動スクロール
                    if (!this.grabbingTimer) {
                        this.grabbingTimer = setInterval(() => {
                            if (!Editor.ptInRect(this.grabbingCursorX, this.grabbingCursorY, rect)) {
                                const x = this.grabbingCursorX - rect.left;
                                const y = this.grabbingCursorY - rect.top;
                                let dx = 0;
                                let dy = 0;

                                if (x < 0)
                                    dx = Math.floor(x * Editor.AUTO_SCROLL_SPEED);
                                else if (x > rect.right - rect.left)
                                    dx = Math.floor((x - (rect.right - rect.left)) * Editor.AUTO_SCROLL_SPEED);

                                if (y < 0)
                                    dy = Math.floor(y * Editor.AUTO_SCROLL_SPEED);
                                else if (y > rect.bottom - rect.top)
                                    dy = Math.floor((y - (rect.bottom - rect.top)) * Editor.AUTO_SCROLL_SPEED);

                                if (0 !== dx || 0 !== dy) {
                                    this.container.scrollLeft += dx;
                                    this.container.scrollTop += dy;

                                    this.doResize(x + this.container.scrollLeft - this.grabbingFirstScrollLeft, y + this.container.scrollTop - this.grabbingFirstScrollTop);
                                }
                            }
                        }, Editor.AUTO_SCROLL_INTERVAL);
                    }
                }
            }
        }, false);

        // マウスが移動したとき
        iframe.contentWindow.addEventListener("mousemove", (event) => {
            onMouseMove(this, event, 0, 0);

            if (this.grabbingTimer) {
                clearInterval(this.grabbingTimer);
                this.grabbingTimer = null;
            }
        }, false);

        // ドラッグがESCキーなどによってキャンセルされた場合
        iframe.contentWindow.addEventListener("dragend", () => {
            this.iframe.contentDocument.documentElement.style.setProperty("--editor-image-cursor", "grab");
        }, false);

        // ドロップされたとき
        iframe.contentWindow.addEventListener("drop", () => {
            this.iframe.contentDocument.documentElement.style.setProperty("--editor-image-cursor", "grab");
        }, false);

        // 選択が開始されたとき
        iframe.contentDocument.addEventListener("selectstart", () => {
            this.iframe.contentDocument.body.classList.add("single-image-select");
        }, false);

        // 選択範囲が変更されたとき
        iframe.contentDocument.addEventListener("selectionchange", () => {
            this.onSelectionChange();
        }, false);

        // inputの直前イベント
        this.editor.addEventListener("beforeinput", (event) => {
            // 念のためデフォルトのアンドゥ操作を禁止しておく（場合によってはいらないかもしれない）
            if (event.inputType && event.inputType.toLowerCase().startsWith("history")) {
                event.preventDefault();
                return false;
            }

            this.inputType = "";
            if (event.inputType)
                this.inputType = event.inputType;

            this.inputByUser = true;
        }, false);

        // inputイベント
        this.editor.addEventListener("input", (event) => {
            this.setHandleRect(this.selectedElement);
        }, false);

        // IMEの入力開始時
        this.editor.addEventListener("compositionstart", (event) => {
            // なにも選択されてなければ専用のリストに追加していき、IME入力完了後にアンドゥリストに追加する
            const selection = iframe.contentWindow.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);

                if (!range.collapsed)
                    this.isFirstIme = true;
            }

            this.resetUndo();
        }, false);

        // IMEの入力終了後
        this.editor.addEventListener("compositionend", (event) => {
            if (this.imeUndoItem) {
                // 文字が入力された場合のみアンドゥリストに追加する
                // (入力がキャンセルされた場合も event.data.lengthはゼロになる)
                if (0 !== event.data.length)
                    this.pushImeUndo(this.imeUndoItem);

                this.imeUndoItem = null;
            }

            this.resetUndo();
        }, false);

        // 右クリックメニュー
        document.addEventListener("contextmenu", (event) => {
            if (this.releaseGrabbing())
                this.resetUndo();
        }, false);

        // 右クリックメニュー
        iframe.contentWindow.addEventListener("contextmenu", (event) => {
            if (this.releaseGrabbing())
                this.resetUndo();
        }, false);

        // エディタの変更を監視
        new MutationObserver((mutations) => {
            this.onMutate(mutations, null);
        }).observe(this.editor, { attributes: true, attributeOldValue: true, childList: true, subtree: true, characterData: true, characterDataOldValue: true });

        // リサイズハンドル
        const resizeHandles = ["left-top", "center-top", "right-top", "left-middle", "right-middle", "left-bottom", "center-bottom", "right-bottom"];
        for (let handle of resizeHandles) {
            const handleElement = iframe.contentDocument.getElementById("handle-" + handle);

            if (handleElement) {
                handleElement.addEventListener("mousedown", (event) => {
                    if (0 === event.button) {
                        this.beginResize(handle, event);

                        event.preventDefault();
                        event.stopPropagation();
                        return false;
                    }
                }, false);
            }
        }
    }

    // 強制的に再描画
    forceRedraw() {
        const left = this.container.scrollLeft;
        const top = this.container.scrollTop;

        const disp = this.editor.style.display;
        this.editor.style.display = "none";
        const trick = this.editor.offsetHeight;
        this.editor.style.display = disp;

        this.container.scrollLeft = left;
        this.container.scrollTop = top;
    }

    // 選択範囲を設定
    static setSelection(iframe, selectionRange) {
        if (selectionRange) {
            const selection = iframe.contentWindow.getSelection();

            if (selection) {
                const range = iframe.contentDocument.createRange();

                range.setStart(selectionRange.startContainer, selectionRange.startOffset);
                range.setEnd(selectionRange.endContainer, selectionRange.endOffset);

                selection.removeAllRanges();
                selection.addRange(range);
            }
        }
    }

    // 選択範囲を得る
    // 返り値はgetSelection()の値ではなくSelectionRangeというクラスであることに注意
    getSelectionRange() {
        const selection = this.iframe.contentWindow.getSelection();
        if (!selection || selection.rangeCount <= 0)
            return null;

        const range = selection.getRangeAt(0);

        return new SelectionRange(range.startContainer, range.startOffset, range.endContainer, range.endOffset);
    }

    // キャレットの位置を得る
    getRangeRect(selection, range) {
        const rects = range.getClientRects();
        if (0 === rects.length) {
            if (selection.baseNode && selection.baseNode.parentNode)
                return selection.baseNode.parentNode.getBoundingClientRect();
        } else
            return range.getBoundingClientRect();

        return null;
    }

    // 選択範囲までスクロール
    scrollToSelection() {
        const selection = this.iframe.contentWindow.getSelection();

        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0).cloneRange();
            const rect = this.getRangeRect(selection, range);

            if (rect) {
                const clientWidth = this.container.clientWidth;
                if (rect.right >= clientWidth)
                    this.container.scrollLeft += rect.right - clientWidth;
                else if (rect.left < 0)
                    this.container.scrollLeft += rect.left;

                const clientHeight = this.container.clientHeight;
                if (rect.bottom >= clientHeight)
                    this.container.scrollTop += rect.bottom - clientHeight;
                else if (rect.top < 0)
                    this.container.scrollTop += rect.top;
            }
        }
    }

    // 選択範囲が変更されたときに呼び出される
    onSelectionChange() {
        {
            const selection = this.getSelectionRange();

            if (!this.inputByUser) {
                if (!this.selection) {
                    if (selection)
                        this.resetUndo();
                } else if (this.selection) {
                    if (!this.selection.isSameSelection(selection))
                        this.resetUndo();
                }
            } else
                this.inputByUser = false;

            this.selection = selection;
        }

        const selection = this.iframe.contentWindow.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const clone = range.cloneContents();

            let imageSelect = false;
            if (1 === clone.children.length) {
                if (("img" === clone.children[0].tagName.toLowerCase()) && (0 === range.toString().length))
                    imageSelect = true;
            }
            this.iframe.contentDocument.body.classList.toggle("single-image-select", imageSelect);
            this.ignoreModify();
            this.forceRedraw();

            if (!this.grabbingHandle) {
                let element = null;

                if (1 === clone.children.length) {
                    if (("img" === clone.children[0].tagName.toLowerCase()) && (0 === range.toString().length)) {
                        const images = this.iframe.contentDocument.getElementsByTagName("img");

                        for (let i = images.length - 1; i >= 0; i--) {
                            const nodeRange = this.iframe.contentDocument.createRange();
                            nodeRange.selectNode(images[i]);

                            const nodeIsBefore = range.compareBoundaryPoints(Range.START_TO_START, nodeRange) === -1;
                            const nodeIsAfter = range.compareBoundaryPoints(Range.END_TO_END, nodeRange) === 1;
                            if (!nodeIsBefore && !nodeIsAfter) {
                                element = images[i];
                                break;
                            }
                        }
                    }
                }

                if (element !== this.selectedElement) {
                    if (element) {
                        if (this.handle)
                            this.setHandleRect(element);

                        this.showHandle(true);
                    } else
                        this.showHandle(false);

                    this.selectedElement = element;
                }
            }

            if (!this.selectedElement) {
                let element = null;

                const tables = Array.from(this.iframe.contentDocument.querySelectorAll("table,th,td"));
                for (let i = tables.length - 1; i >= 0; i--) {
                    const nodeRange = this.iframe.contentDocument.createRange();
                    try {
                        nodeRange.selectNode(tables[i]);
                    } catch (error) {
                        nodeRange.selectNodeContents(tables[i]);
                    }

                    const nodeIsBefore = range.compareBoundaryPoints(Range.START_TO_START, nodeRange) === -1;
                    const nodeIsAfter = range.compareBoundaryPoints(Range.END_TO_END, nodeRange) === 1;
                    if (range.compareBoundaryPoints(Range.START_TO_END, nodeRange) !== 0) {
                        if (!nodeIsBefore && !nodeIsAfter) {
                            element = tables[i];
                            break;
                        }
                    }
                }

                if (element) {
                    this.selectedElement = element;

                    this.setHandleRect(element);
                    this.showHandle(true);
                }
            }
        }

        // ツールバーのフォントサイズの値を変更
        // UIの処理なので以下は適宜書き換え、もしくは削除
        {
            const fontsize = this.getCursorFontSize();

            const fontSizeElement = document.getElementById("fontsize");
            if (fontSizeElement)
                fontSizeElement.value = fontsize;

            const fontSizeTextElement = document.getElementById("fontsize-text");
            if (fontSizeTextElement)
                fontSizeTextElement.textContent = parseFloat(fontsize.toFixed(3)) + "px";
        }
    }

    // 変更があったときに呼び出される
    onMutate(mutations, selection) {
        if (this.isIgnoreModify) {
            this.isIgnoreModify = false;
            return;
        }

        // IME入力中は専用のリストにアンドゥアイテムを追加していく
        if (this.isFirstIme) {
            this.isFirstIme = false;

            this.pushImeUndoItem(mutations, this.selection);   // 引数のselectionではない
            this.pushImeUndoItemContinuous(null, this.getSelectionRange());

            return;
        } else if (this.imeUndoItem) {
            this.pushImeUndoItemContinuous(mutations, null);
            this.pushImeUndoItemContinuous(null, this.getSelectionRange());

            return;
        }

        const type = this.inputType.toLowerCase();
        if ("insertfrompaste" === type || "deletebycut" === type)
            this.resetUndo();

        if (this.inputByUser && "insertfromdrop" === type && this.isSameUndoType("deleteByDrag")) {
            this.setUndoType("insertFromDrop");

            this.pushUndoContinuous(mutations, null);
            this.pushUndoContinuous(null, this.getSelectionRange());

            this.resetUndo();
        } else if (this.inputByUser && "insertfromdrop" === type) {
            this.pushUndo(null, this.selection);
            this.pushUndoContinuous(mutations, null);
            this.pushUndoContinuous(null, this.getSelectionRange());

            this.resetUndo();
            this.isFirstUndo = false;
        } else if (this.inputByUser && "deletebydrag" === type) {
            this.pushUndo(null, this.selection);
            this.pushUndoContinuous(mutations, null);
            this.pushUndoContinuous(null, this.getSelectionRange());
        } else {
            if (this.isFirstUndo || !this.isSameUndoType(this.inputType)) {
                this.isFirstUndo = false;
                this.pushUndo(mutations, this.selection);   // 引数のselectionではない
            } else
                this.pushUndoContinuous(mutations, selection);

            this.pushUndoContinuous(null, this.getSelectionRange());
        }

        // BSキーでは選択範囲の変更イベントが発生しないので自発的に発生させている
        if ("deletecontentbackward" === type)
            this.onSelectionChange();
    }

    // アンドゥの連続記録をリセットし、次回から新たなアンドゥとする
    resetUndo() {
        this.isFirstUndo = true;
    }

    // 古い値を記憶しておく
    rememberMutationValue(mutations) {
        if (mutations) {
            for (let mutation of mutations) {
                const type = mutation.type.toLowerCase();

                if ("characterdata" === type) {
                    if (mutation.target)
                        mutation._currentValue = mutation.target.textContent;

                    mutation._oldValue = mutation.oldValue;
                } else if ("attributes" === type) {
                    if (mutation.target)
                        mutation._currentValue = mutation.target.getAttribute(mutation.attributeName);
                }
            }
        }

        return mutations;
    }

    // アンドゥを追加
    pushUndo(mutations, selection) {
        this.undoList.length = this.undoPosition + 1;
        this.undoList[this.undoPosition] = new UndoItem(this.inputType);
        this.undoList[this.undoPosition].pushMutation(this.rememberMutationValue(mutations), selection);
        this.undoPosition++;

        this.onModifyUndo();
    }

    // アンドゥを連続的に追加
    pushUndoContinuous(mutations, selection) {
        this.undoList[this.undoPosition - 1].pushMutation(this.rememberMutationValue(mutations), selection);

        this.onModifyUndo();
    }

    // IMEのアンドゥを追加
    pushImeUndoItem(mutations, selection) {
        this.imeUndoItem = new UndoItem(this.inputType);
        this.imeUndoItem.pushMutation(this.rememberMutationValue(mutations), selection);
    }

    // IMEのアンドゥを連続的に追加
    pushImeUndoItemContinuous(mutations, selection) {
        this.imeUndoItem.pushMutation(this.rememberMutationValue(mutations), selection);
    }

    // IMEアンドゥアイテムを追加
    pushImeUndo(imeUndoItem) {
        this.undoList.length = this.undoPosition + 1;
        this.undoList[this.undoPosition] = imeUndoItem;
        this.undoPosition++;

        this.onModifyUndo();
    }

    // リサイズアンドゥを追加
    pushResizeUndo() {
        this.undoList.length = this.undoPosition + 1;
        this.undoList[this.undoPosition] = new ResizeUndoItem(this.inputType, this.grabbingElement, this.grabbingElement.getAttribute("style"), this.getSelectionRange());
        this.undoPosition++;

        this.onModifyUndo();
    }

    // リサイズアンドゥにサイズ変更を伝える
    onResizeElement() {
        this.undoList[this.undoPosition - 1].onResize();
    }

    // アンドゥ
    undo() {
        if (!this.canUndo())
            return;

        this.releaseGrabbing();

        this.ignoreModify();
        this.resetUndo();

        this.undoPosition--;
        this.undoList[this.undoPosition].undo(this.iframe);

        this.setHandleRect(this.selectedElement);

        this.scrollToSelection();

        this.onModifyUndo();
    }

    // リドゥ
    redo() {
        if (!this.canRedo())
            return;

        this.releaseGrabbing();

        this.ignoreModify();
        this.resetUndo();

        this.undoList[this.undoPosition].redo(this.iframe);
        this.undoPosition++;

        this.setHandleRect(this.selectedElement);

        this.scrollToSelection();

        this.onModifyUndo();
    }

    // 1回だけ変更を無視
    ignoreModify() {
        this.isIgnoreModify = true;
    }

    // 直前のアンドゥが指定したタイプと同じか
    isSameUndoType(type) {
        if (!this.canUndo())
            return false;

        return this.undoList[this.undoPosition - 1].type.toLowerCase() === type.toLowerCase();
    }

    // 直前のアンドゥアイテムを削除
    removePrevUndoItem() {
        if (!this.canUndo())
            return;

        this.undoList.splice(this.undoPosition - 1, 1);
        this.undoPosition--;
    }

    // アンドゥバッファをクリア
    clearUndo() {
        this.ignoreModify();
        this.forceRedraw();

        this.undoList.length = 0;
        this.undoPosition = 0;
    }

    // アンドゥ可能か
    canUndo() {
        return 0 !== this.undoPosition;
    }

    // リドゥ可能か
    canRedo() {
        return this.undoList.length !== this.undoPosition;
    }

    // 現在のアンドゥの入力タイプを変更
    setUndoType(type) {
        if (this.canUndo())
            this.undoList[this.undoPosition - 1].type = type;
    }

    // アンドゥの入力タイプを得る
    getUndoType() {
        if (!this.canUndo())
            return "";

        return this.undoList[this.undoPosition - 1].type;
    }

    // リドゥの入力タイプを得る
    getRedoType() {
        if (!this.canRedo())
            return "";

        return this.undoList[this.undoPosition].type;
    }

    // 日本語のアンドゥ名を得る
    static getJapaneseUndoName(type) {
        if (!type)
            return "";

        const type2 = type.toLowerCase();
        if ("inserttext" === type2)
            return "文字の入力";
        else if ("insertreplacementtext" === type2 || "insertfromyank" === type2)
            return "置換";
        else if ("insertlinebreak" === type2 || "insertparagraph" === type2)
            return "改行";
        else if ("insertorderedlist" === type2)
            return "番号付きリストの挿入";
        else if ("insertunorderedlist" === type2)
            return "番号無しリストの挿入";
        else if ("inserthorizontalrule" === type2)
            return "段落区切り罫線の挿入";
        else if ("insertfromdrop" === type2)
            return "ドラッグ&ドロップ";
        else if ("insertfrompaste" === type2 || "insertfrompastessquotation" === type2)
            return "貼り付け";
        else if ("inserttranspose" === type2)
            return "転置";
        else if ("insertcompositiontext" === type2 || "insertfromcomposition" === type2 || "deletebycomposition" === type2)
            return "IME入力";
        else if ("insertlink" === type2)
            return "リンクの挿入";
        else if ("deletebycut" === type2)
            return "切り取り";
        else if (type2.startsWith("delete"))
            return "削除";
        else if ("formatbold" === type2)
            return "太字";
        else if ("formatitalic" === type2)
            return "斜体";
        else if ("formatunderline" === type2)
            return "下線";
        else if ("formatstrikethrough" === type2)
            return "打ち消し線";
        else if ("formatsuperscript" === type2)
            return "上付き文字";
        else if ("formatsubscript" === type2)
            return "下付き文字";
        else if ("formatjustifyfull" === type2)
            return "両端揃え";
        else if ("formatjustifycenter" === type2)
            return "中央揃え";
        else if ("formatjustifyright" === type2)
            return "右端揃え";
        else if ("formatjustifyleft" === type2)
            return "左端揃え";
        else if ("formatindent" === type2)
            return "インデント";
        else if ("formatoutdent" === type2)
            return "インデントの解除";
        else if ("formatremove" === type2)
            return "書体の初期化";
        else if ("formatsetblocktextdirection" === type2)
            return "ブロック方向の設定";
        else if ("formatsetinlinetextdirection" === type2)
            return "行内方向の設定";
        else if ("formatbackcolor" === type2)
            return "背景色の変更";
        else if ("formatfontcolor" === type2)
            return "文字色の変更";
        else if ("formatfontname" === type2)
            return "フォントの変更";
        else if ("formatfontsize" === type2)
            return "フォントサイズの変更";
        else if ("resizeimage" === type2)
            return "画像サイズの変更";
        else if ("resizetable" === type2)
            return "テーブルのサイズ変更";
        else if ("resizetablecell" === type2)
            return "テーブルセルのサイズ変更";

        return type;
    }

    // アンドゥ状態に変化があったときに呼び出される
    onModifyUndo() {
        const undoElement = document.getElementById("undo");
        if (undoElement) {
            undoElement.classList.toggle("unenabled", !this.canUndo());
            undoElement.title = Editor.getJapaneseUndoName(this.getUndoType());
        }

        const redoElement = document.getElementById("redo");
        if (redoElement) {
            redoElement.classList.toggle("unenabled", !this.canRedo());
            redoElement.title = Editor.getJapaneseUndoName(this.getRedoType());
        }
    }

    // コマンドを実行
    command(commandid, type, value) {
        this.releaseGrabbing();

        // execCommandを使用するとbeforeinputイベントが起こらないので、ここで入力タイプを記憶しておく必要がある
        this.inputType = "";
        if (type)
            this.inputType = type;

        this.inputByUser = true;

        this.iframe.contentDocument.execCommand(commandid, false, value);

        this.scrollToSelection();
    }

    // クリア
    clear() {
        this.releaseGrabbing();

        this.inputType = "clear";
        this.inputByUser = true;

        this.iframe.contentDocument.execCommand("selectAll", false, null);
        this.iframe.contentDocument.execCommand("removeFormat", false, null);
        this.iframe.contentDocument.execCommand("delete", false, null);
        this.editor.innerHTML = "";

        this.resetUndo();

        this.showHandle(false);

        this.scrollToSelection();
    }

    // フォーマットを削除
    removeFormat() {
        this.command("removeFormat", "formatRemove", null);
        this.resetUndo();
    }

    // 太字
    bold() {
        this.command("bold", "formatBold", null);
        this.resetUndo();
    }

    // 斜体
    italic() {
        this.command("italic", "formatItalic", null);
        this.resetUndo();
    }

    // 下線
    underline() {
        this.command("underline", "formatUnderline", null);
        this.resetUndo();
    }

    // 打ち消し線
    strikeThrough() {
        this.command("strikeThrough", "formatStrikeThrough", null);
        this.resetUndo();
    }

    // フォントサイズを設定
    // とりあえず最大サイズに変更しておき、あとから選択ノードのフォントサイズを変更する
    setFontSize(size) {
        this.command("fontSize", "formatFontSize", 7);

        const selection = this.iframe.contentWindow.getSelection();
        if (selection && selection.rangeCount > 0) {
            const elements = this.iframe.contentDocument.querySelectorAll("span");

            for (let element of elements) {
                if (selection.containsNode(element, true)) {
                    if (element.style.fontSize && "xxx-large" === element.style.fontSize.toLowerCase())
                        element.style.fontSize = size + "px";
                }
            }
        }
    }

    // カーソル位置のフォントサイズを得る
    getCursorFontSize() {
        let node = null;

        const selection = this.iframe.contentWindow.getSelection();
        if (selection && selection.rangeCount > 0) {
            node = selection.getRangeAt(0).startContainer;

            if (Node.TEXT_NODE === node.nodeType)
                node = node.parentNode;
        }

        if (!node)
            return 0;

        return parseFloat(this.iframe.contentWindow.getComputedStyle(node, null)["fontSize"]);
    }

    // 文字の色を変更
    setFontColor(color) {
        this.command("foreColor", "formatFontColor", color);
    }

    // ハンドルの矩形を設定
    setHandleRect(element) {
        if (element)
            this.setHandleRectByRect(element.getBoundingClientRect());
    }

    // ハンドルの矩形を設定
    setHandleRectByRect(rect) {
        this.handle.style.left = rect.left + "px";
        this.handle.style.top = rect.top + "px";
        this.handle.style.width = rect.width + "px";
        this.handle.style.height = rect.height + "px";
    }

    // ハンドルを表示/非表示
    showHandle(show) {
        if (this.handle)
            this.handle.style.display = show ? "initial" : "";
    }

    // 画像を選択
    selectImage(image) {
        if (!image)
            return;

        const selection = this.iframe.contentWindow.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = this.iframe.contentDocument.createRange();

            range.selectNode(image);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }

    // リサイズ開始
    beginResize(handle, event) {
        this.grabbingElement = this.selectedElement;
        this.grabbingHandle = handle;

        if (this.grabbingElement) {
            const rect = this.grabbingElement.getBoundingClientRect();

            if (-1 !== this.grabbingHandle.indexOf("left"))
                this.grabbingFirstX = -parseInt(rect.left) + event.pageX;
            else if (-1 !== this.grabbingHandle.indexOf("right"))
                this.grabbingFirstX = parseInt(rect.right) - event.pageX;

            if (-1 !== this.grabbingHandle.indexOf("top"))
                this.grabbingFirstY = -parseInt(rect.top) + event.pageY;
            else if (-1 !== this.grabbingHandle.indexOf("bottom"))
                this.grabbingFirstY = parseInt(rect.bottom) - event.pageY;

            this.grabbingFirstLeft = rect.left;
            this.grabbingFirstTop = rect.top;
            this.grabbingFirstWidth = rect.width;
            this.grabbingFirstHeight = rect.height;

            this.grabbingFirstScrollLeft = this.container.scrollLeft;
            this.grabbingFirstScrollTop = this.container.scrollTop;

            const tag = this.grabbingElement.tagName.toLowerCase();
            if ("img" === tag)
                this.inputType = "resizeImage";
            else if ("table" === tag)
                this.inputType = "resizeTable";
            else if ("th" === tag || "td" === tag)
                this.inputType = "resizeTableCell";

            // リサイズ中は一時的に全体のマウスを変更しておく
            let cursor = "unset";
            if (-1 !== this.grabbingHandle.indexOf("left")) {
                if (-1 !== this.grabbingHandle.indexOf("top"))
                    cursor = "nwse-resize";
                else if (-1 !== this.grabbingHandle.indexOf("bottom"))
                    cursor = "nesw-resize";
                else
                    cursor = "ew-resize";
            } else if (-1 !== this.grabbingHandle.indexOf("right")) {
                if (-1 !== this.grabbingHandle.indexOf("top"))
                    cursor = "nesw-resize";
                else if (-1 !== this.grabbingHandle.indexOf("bottom"))
                    cursor = "nwse-resize";
                else
                    cursor = "ew-resize";
            } else {
                cursor = "ns-resize";
            }
            this.iframe.contentDocument.documentElement.style.setProperty("--editor-cursor", cursor);
            this.iframe.contentDocument.documentElement.style.setProperty("--editor-image-cursor", cursor);

            // リサイズアンドゥを追加
            this.pushResizeUndo();
        }
    }

    // リサイズを実行
    doResize(x, y) {
        const rect = this.grabbingElement.getBoundingClientRect();
        let width = rect.width;
        let height = rect.height;

        if (-1 !== this.grabbingHandle.indexOf("left"))
            width = this.grabbingFirstX + this.grabbingFirstWidth + (this.grabbingFirstLeft - x);
        else if (-1 !== this.grabbingHandle.indexOf("right"))
            width = this.grabbingFirstX + x - this.grabbingFirstLeft;
        else
            width = this.grabbingFirstWidth;

        if (-1 !== this.grabbingHandle.indexOf("top"))
            height = this.grabbingFirstY + this.grabbingFirstHeight + (this.grabbingFirstTop - y);
        else if (-1 !== this.grabbingHandle.indexOf("bottom"))
            height = this.grabbingFirstY + y - this.grabbingFirstTop;
        else
            height = this.grabbingFirstHeight;

        // 画像なら縦横比を固定
        if ("img" === this.grabbingElement.tagName.toLowerCase()) {
            if (0 !== this.grabbingElement.naturalWidth && 0 !== this.grabbingElement.naturalHeight) {
                const divideWH = this.grabbingElement.naturalWidth / this.grabbingElement.naturalHeight;
                const divideHW = this.grabbingElement.naturalHeight / this.grabbingElement.naturalWidth;

                if (-1 !== this.grabbingHandle.indexOf("center"))
                    width = parseInt(height * divideWH);
                else
                    height = parseInt(width * divideHW);

                if (-1 !== this.grabbingHandle.indexOf("middle"))
                    height = parseInt(width * divideHW);
                else
                    width = parseInt(height * divideWH);

                if (width > height) {
                    width = parseInt(height * divideWH);

                    if (height > parseInt(rect.width * divideHW))
                        height = parseInt(rect.width * divideHW);
                } else {
                    height = parseInt(width * divideHW);

                    if (width > parseInt(rect.height * divideWH))
                        width = parseInt(rect.height * divideWH);
                }
            }
        }

        if (width < Editor.ELEMENT_MIN_SIZE)
            width = Editor.ELEMENT_MIN_SIZE;

        if (height < Editor.ELEMENT_MIN_SIZE)
            height = Editor.ELEMENT_MIN_SIZE;

        Editor.setElementSize(this.grabbingElement, width, height);

        this.onResizeElement();

        this.ignoreModify();

        this.setHandleRect(this.grabbingElement);
    }

    // 要素をつかんでいるかどうか
    isGrabbing() {
        return this.grabbingElement && this.grabbingHandle;
    }

    // つかんでいる要素を離す
    // 何かつかんでいればtrueを返す
    releaseGrabbing() {
        this.iframe.contentDocument.documentElement.style.setProperty("--editor-image-cursor", "grab");

        if (this.grabbingTimer) {
            clearInterval(this.grabbingTimer);
            this.grabbingTimer = null;
        }

        if (this.isGrabbing()) {
            this.grabbingElement = null;
            this.grabbingHandle = null;

            this.iframe.contentDocument.documentElement.style.setProperty("--editor-cursor", "unset");

            return true;
        }

        return false;
    }

    // 要素をリサイズ
    static setElementSize(element, width, height) {
        if (element) {
            let style = element.getAttribute("style");
            if (!style)
                style = "";

            style = style.replace(/width\s*:\s*[\w\s()\-.,%#]+;?/gi, "");
            style = style.replace(/height\s*:\s*[\w\s()\-.,%#]+;?/gi, "");

            element.setAttribute("style", style + " width: " + width + "px; height: " + height + "px;");
        }
    }

    // 要素のスタイルを設定
    static setElementStyle(element, style) {
        if (element) {
            if (style)
                element.setAttribute("style", style);
            else
                element.removeAttribute("style");
        }
    }

    // フォーカスを得る
    focus() {
        this.editor.focus();
    }

    // 矩形が点を含むか
    static ptInRect(x, y, rect) {
        if (x >= rect.left && y >= rect.top && x <= rect.right && y <= rect.bottom)
            return true;

        return false;
    }
}


const editor = new Editor();

function onLoadFrame(iframe) {
    editor.setFrame(iframe);
    editor.focus();
}

function onClickUndo() {
    editor.undo();
}

function onClickRedo() {
    editor.redo();
}

function onClickBold() {
    editor.bold();
}

function onClickItalic() {
    editor.italic();
}

function onClickUnderline() {
    editor.underline();
}

function onClickStrikethrough() {
    editor.strikeThrough();
}

function onFontColor(color) {
    editor.setFontColor(color);
    editor.focus();
}

function onFontSize(size) {
    editor.setFontSize(size);

    const fontSizeTextElement = document.getElementById("fontsize-text");
    if (fontSizeTextElement)
        fontSizeTextElement.textContent = size + "px";

    editor.focus();
}

function onClickRemoveFormat() {
    editor.removeFormat();
}

function onClickClear() {
    editor.clear();
}

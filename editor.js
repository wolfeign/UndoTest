// エディタのアンドゥ・リドゥのテストを目的としたプログラム
// 制作者:wolfeign(@wolfeign)
// 制作日:2022/8/26(Fri)
// 
// ライセンス:MITライセンス


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
}

// エディタクラス
class Editor {
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
        this.grappingElement = null;
        // つかんでいるハンドル
        this.grappingHandle = null;
        // つかんだ位置
        this.grappingFirstX = 0;
        this.grappingFirstY = 0;
        // つかんだ要素の位置とサイズ
        this.grappingFirstLeft = 0;
        this.grappingFirstTop = 0;
        this.grappingFirstWidth = 0;
        this.grappingFirstHeight = 0;

        // 入力タイプ
        this.inputType = "";
        // ユーザーにより入力されたか
        this.inputByUser = false;

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

        // CSSを使用する
        iframe.contentDocument.execCommand("styleWithCSS", false, true);

        // スクロールイベント
        if (this.container) {
            this.container.addEventListener("scroll", () => {
                this.setHandleRect(this.selectedElement);
            }, false);
        }

        // エディタのサイズ変更を監視
        new ResizeObserver(() => {
            this.setHandleRect(this.selectedElement);
        }).observe(this.editor);

        // キーの押下
        iframe.contentWindow.addEventListener("keydown", (event) => {
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
            }
        }, false);

        // マウスが押されたとき
        iframe.contentWindow.addEventListener("mousedown", (event) => {
            this.handle.classList.add("handle-pointer-events-none");

            const element = iframe.contentDocument.elementFromPoint(event.pageX, event.pageY);
            if (element && element.tagName) {
                if ("img" === element.tagName.toLowerCase()) {
                    if (0 === event.button) {
                        // 画像のみを選択
                        this.selectImage(element);

                        this.iframe.contentDocument.body.classList.add("single-image-select");
                        this.ignoreModify();
                    }
                }
            }
        }, false);

        // マウスが離されたとき
        iframe.contentWindow.addEventListener("mouseup", (event) => {
            this.grappingElement = null;
            this.grappingHandle = null;

            this.iframe.contentDocument.body.style.cursor = "";
            this.editor.classList.remove("editor-image-default-cursor");
            this.handle.classList.remove("handle-pointer-events-none");

            this.ignoreModify();
        });

        // マウスが移動したとき
        iframe.contentWindow.addEventListener("mousemove", (event) => {
            if (0 === event.buttons & 1) {
                if (this.grappingElement && this.grappingHandle) {
                    this.grappingElement = null;
                    this.grappingHandle = null;

                    this.iframe.contentDocument.body.style.cursor = "";
                    this.editor.classList.remove("editor-image-default-cursor");
                    this.handle.classList.remove("handle-pointer-events-none");

                    this.ignoreModify();
                }

                return;
            }

            if (this.grappingElement && this.grappingHandle) {
                const rect = this.grappingElement.getBoundingClientRect();
                let grappingWidth = rect.width;
                let grappingHeight = rect.height;

                if (-1 !== this.grappingHandle.indexOf("left"))
                    grappingWidth = this.grappingFirstX + this.grappingFirstWidth + (this.grappingFirstLeft - event.pageX);
                else if (-1 !== this.grappingHandle.indexOf("right"))
                    grappingWidth = this.grappingFirstX + event.pageX - this.grappingFirstLeft;
                else
                    grappingWidth = this.grappingFirstWidth;

                if (-1 !== this.grappingHandle.indexOf("top"))
                    grappingHeight = this.grappingFirstY + this.grappingFirstHeight + (this.grappingFirstTop - event.pageY);
                else if (-1 !== this.grappingHandle.indexOf("bottom"))
                    grappingHeight = this.grappingFirstY + event.pageY - this.grappingFirstTop;
                else
                    grappingHeight = this.grappingFirstHeight;

                // 縦横比を固定
                if ("img" === this.grappingElement.tagName.toLowerCase()) {
                    if (0 !== this.grappingElement.naturalWidth && 0 !== this.grappingElement.naturalHeight) {
                        const divideWH = this.grappingElement.naturalWidth / this.grappingElement.naturalHeight;
                        const divideHW = this.grappingElement.naturalHeight / this.grappingElement.naturalWidth;

                        if (-1 !== this.grappingHandle.indexOf("center"))
                            grappingWidth = parseInt(grappingHeight * divideWH);
                        else
                            grappingHeight = parseInt(grappingWidth * divideHW);

                        if (-1 !== this.grappingHandle.indexOf("middle"))
                            grappingHeight = parseInt(grappingWidth * divideHW);
                        else
                            grappingWidth = parseInt(grappingHeight * divideWH);

                        if (grappingWidth > grappingHeight) {
                            grappingWidth = parseInt(grappingHeight * divideWH);

                            if (grappingHeight > parseInt(rect.width * divideHW))
                                grappingHeight = parseInt(rect.width * divideHW);
                        } else {
                            grappingHeight = parseInt(grappingWidth * divideHW);

                            if (grappingWidth > parseInt(rect.height * divideWH))
                                grappingWidth = parseInt(rect.height * divideWH);
                        }
                    }
                }

                // 要素の最小サイズを10にしているが変更しても良い
                if (grappingWidth < 10)
                    grappingWidth = 10;

                if (grappingHeight < 10)
                    grappingHeight = 10;

                this.setElementSize(this.grappingElement, grappingWidth, grappingHeight);

                this.setHandleRect(this.grappingElement);
            }
        });

        // ドラッグがESCキーなどによってキャンセルされた場合
        iframe.contentWindow.addEventListener("dropend", () => {
            this.handle.classList.remove("handle-pointer-events-none");
        }, false);

        // ドロップされたとき
        iframe.contentWindow.addEventListener("drop", () => {
            this.handle.classList.remove("handle-pointer-events-none");
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

        // IMEの入力開始
        this.editor.addEventListener("compositionstart", (event) => {
            this.resetUndo();
        }, false);

        // IMEの入力終了後
        this.editor.addEventListener("compositionend", (event) => {
            // 文字が入力されなかったもしくはキャンセルされた場合、直前のアンドゥを削除しておく
            if (0 === event.data.length)
                this.removePrevUndoItem();

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
                    }
                });
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
    // キャレットが左端にあるとき矩形の位置がゼロになるので一時ノードを追加して位置を求めている
    // 参考:https://stackoverflow.com/questions/50022681/range-getboundingclientrect-returns-zero-for-all-values-after-selecting-a-node
    getRangeRect(range) {
        let rect = range.getBoundingClientRect();
        if (range.collapsed && 0 === rect.top && 0 === rect.left) {
            this.ignoreModify();

            const node = this.iframe.contentDocument.createTextNode('\ufeff');
            range.insertNode(node);
            rect = range.getBoundingClientRect();
            node.remove();
        }

        return rect;
    }

    // 選択範囲までスクロール
    scrollToSelection() {
        const selection = this.iframe.contentWindow.getSelection();

        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0).cloneRange();
            const rect = this.getRangeRect(range);

            if (rect.right >= this.container.clientWidth)
                this.container.scrollLeft += rect.right - this.container.clientWidth;
            else if (rect.left < 0)
                this.container.scrollLeft += rect.left;

            if (rect.bottom >= this.container.clientHeight)
                this.container.scrollTop += rect.bottom - this.container.clientHeight;
            else if (rect.top < 0)
                this.container.scrollTop += rect.top;
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

            if (!this.grappingHandle) {
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

            const fontsizeElement = document.getElementById("fontsize");
            if (fontsizeElement)
                fontsizeElement.value = fontsize;

            const fontsizeLabelElement = document.getElementById("fontsize-text");
            if (fontsizeLabelElement)
                fontsizeLabelElement.textContent = parseFloat(fontsize.toFixed(3)) + "px";
        }
    }

    // 変更があったときに呼び出される
    onMutate(mutations, selection) {
        if (this.isIgnoreModify) {
            this.isIgnoreModify = false;
            return;
        }

        const type = this.inputType.toLowerCase();
        if (this.inputByUser && "insertfromdrop" === type && this.isSameUndoType("deleteByDrag")) {
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
    }

    // アンドゥの連続記録をリセットし、次回から新たなアンドゥとする
    resetUndo() {
        this.isFirstUndo = true;
    }

    // アンドゥを追加
    pushUndo(mutations, selection) {
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

        this.undoList.length = this.undoPosition + 1;
        this.undoList[this.undoPosition] = new UndoItem(this.inputType);
        this.undoList[this.undoPosition].pushMutation(mutations, selection);
        this.undoPosition++;

        this.onModifyUndo();
    }

    // アンドゥを連続的に追加
    pushUndoContinuous(mutations, selection) {
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

        this.undoList[this.undoPosition - 1].pushMutation(mutations, selection);

        this.onModifyUndo();
    }

    // アンドゥ
    undo() {
        if (0 === this.undoPosition)
            return;

        this.ignoreModify();
        this.resetUndo();

        this.undoPosition--;

        const item = this.undoList[this.undoPosition];
        for (let i = item.mutationList.length - 1; i >= 0; i--) {
            if (item.mutationList[i].mutations) {
                const mutations = item.mutationList[i].mutations.slice();

                mutations.reverse();
                this.undoMutations(mutations);
            }

            if (item.mutationList[i].selection) {
                const selection = this.iframe.contentWindow.getSelection();

                if (selection) {
                    const range = this.iframe.contentDocument.createRange();

                    range.setStart(item.mutationList[i].selection.startContainer, item.mutationList[i].selection.startOffset);
                    range.setEnd(item.mutationList[i].selection.endContainer, item.mutationList[i].selection.endOffset);
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            }
        }

        this.setHandleRect(this.selectedElement);

        this.scrollToSelection();

        this.onModifyUndo();
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
    redo() {
        if (this.undoList.length === this.undoPosition)
            return;

        this.ignoreModify();
        this.resetUndo();

        for (let item of this.undoList[this.undoPosition].mutationList) {
            if (item.selection) {
                const selection = this.iframe.contentWindow.getSelection();

                if (selection) {
                    const range = this.iframe.contentDocument.createRange();

                    range.setStart(item.selection.startContainer, item.selection.startOffset);
                    range.setEnd(item.selection.endContainer, item.selection.endOffset);
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            }

            if (item.mutations)
                this.redoMutations(item.mutations);
        }

        this.setHandleRect(this.selectedElement);

        this.undoPosition++;

        this.scrollToSelection();

        this.onModifyUndo();
    }

    // 変更をリドゥ
    redoMutations(mutations) {
        try {
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
        } catch (e) {
            alert(e)
        }
    }

    // 1回だけ変更を無視
    ignoreModify() {
        this.isIgnoreModify = true;
    }

    // 直前のアンドゥが指定したタイプと同じか
    isSameUndoType(type) {
        if (0 === this.undoPosition)
            return false;

        return this.undoList[this.undoPosition - 1].type.toLowerCase() === type.toLowerCase();
    }

    // 直前のアンドゥアイテムを削除
    removePrevUndoItem() {
        if (0 === this.undoPosition)
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

    // アンドゥ名を得る
    getUndoName() {
        if (0 === this.undoPosition)
            return "";

        return this.undoList[this.undoPosition - 1].type;
    }

    // リドゥ名を得る
    getRedoName() {
        if (this.undoList.length === this.undoPosition)
            return "";

        return this.undoList[this.undoPosition].type;
    }

    // アンドゥ状態に変化があったときに呼び出される
    onModifyUndo() {
        const undoElement = document.getElementById("undo");
        if (undoElement)
            undoElement.classList.toggle("unenabled", !this.canUndo());

        const redoElement = document.getElementById("redo");
        if (redoElement)
            redoElement.classList.toggle("unenabled", !this.canRedo());
    }

    // コマンドを実行
    command(commandid, type, value) {
        this.inputByUser = true;

        // execCommandを使用するとbeforeinputイベントが起こらないので、ここで入力タイプを記憶しておく必要がある
        this.inputType = "";
        if (type)
            this.inputType = type;

        this.iframe.contentDocument.execCommand(commandid, false, value);

        // 選択範囲までスクロール
        this.scrollToSelection();
    }

    // クリア
    clear() {
        this.inputType = "clear";
        this.inputByUser = true;

        this.editor.innerHTML = "";

        this.resetUndo();

        this.showHandle(false);
    }

    // フォーマットを削除
    removeFormat() {
        this.command("removeFormat", "formatRemove", null);
    }

    // 太字
    bold() {
        this.command("bold", "formatBold", null);
    }

    // 斜体
    italic() {
        this.command("italic", "formatItalic", null);
    }

    // 下線
    underline() {
        this.command("underline", "formatUnderline", null);
    }

    // 打ち消し線
    strikeThrough() {
        this.command("strikeThrough", "formatStrikeThrough", null);
    }

    // フォントサイズを設定
    setFontSize(size) {
        this.command("fontSize", "formatFontSize", 7);

        const selection = this.iframe.contentWindow.getSelection();
        if (selection) {
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
        if (selection.rangeCount > 0) {
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
        if (selection) {
            const range = this.iframe.contentDocument.createRange();

            range.selectNode(image);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }

    // リサイズ開始
    beginResize(grapHandle, event) {
        this.grappingElement = this.selectedElement;
        this.grappingHandle = grapHandle;

        if (this.grappingElement) {
            const rect = this.grappingElement.getBoundingClientRect();

            if (-1 !== this.grappingHandle.indexOf("left"))
                this.grappingFirstX = -parseInt(rect.left) + event.pageX;
            else if (-1 !== this.grappingHandle.indexOf("right"))
                this.grappingFirstX = parseInt(rect.right) - event.pageX;

            if (-1 !== this.grappingHandle.indexOf("top"))
                this.grappingFirstY = -parseInt(rect.top) + event.pageY;
            else if (-1 !== this.grappingHandle.indexOf("bottom"))
                this.grappingFirstY = parseInt(rect.bottom) - event.pageY;

            this.grappingFirstLeft = rect.left;
            this.grappingFirstTop = rect.top;
            this.grappingFirstWidth = rect.width;
            this.grappingFirstHeight = rect.height;

            const tag = this.grappingElement.tagName.toLowerCase();
            if ("img" === tag)
                this.inputType = "resizeImage";
            else if ("table" === tag)
                this.inputType = "resizeTable";
            else if ("th" === tag || "td" === tag)
                this.inputType = "resizeTableCell";

            // ドラッグ中は一時的にiframe全体のカーソルを変更しておく
            if (-1 !== this.grappingHandle.indexOf("left")) {
                if (-1 !== this.grappingHandle.indexOf("top"))
                    this.iframe.contentDocument.body.style.cursor = "nwse-resize";
                else if (-1 !== this.grappingHandle.indexOf("bottom"))
                    this.iframe.contentDocument.body.style.cursor = "nesw-resize";
                else
                    this.iframe.contentDocument.body.style.cursor = "ew-resize";
            } else if (-1 !== this.grappingHandle.indexOf("right")) {
                if (-1 !== this.grappingHandle.indexOf("top"))
                    this.iframe.contentDocument.body.style.cursor = "nesw-resize";
                else if (-1 !== this.grappingHandle.indexOf("bottom"))
                    this.iframe.contentDocument.body.style.cursor = "nwse-resize";
                else
                    this.iframe.contentDocument.body.style.cursor = "ew-resize";
            } else {
                this.iframe.contentDocument.body.style.cursor = "ns-resize";
            }
            this.editor.classList.add("editor-image-default-cursor");

            this.ignoreModify();
        }
    }

    // 要素をリサイズ
    setElementSize(element, width, height) {
        let style = element.getAttribute("style");
        if (!style)
            style = "";

        style = style.replace(/\s*width\s*:\s*[\w\s()\-.,%#]+;?/i, "");
        style = style.replace(/\s*height\s*:\s*[\w\s()\-.,%#]+;?/i, "");

        element.setAttribute("style", style + " width: " + width + "px; height: " + height + "px;");
    }

    // フォーカスを得る
    focus() {
        this.editor.focus();
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

    const fontsizeLabelElement = document.getElementById("fontsize-text");
    if (fontsizeLabelElement)
        fontsizeLabelElement.textContent = size + "px";

    editor.focus();
}

function onClickRemoveFormat() {
    editor.removeFormat();
}

function onClickClear() {
    editor.clear();
}

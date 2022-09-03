# JavaScriptを使用したwysiwygエディタのアンドゥとリドゥ

wysiwygエディタのアンドゥとリドゥの動作確認のみを目的としたプログラム。
Chromeでのみ動作。

A program intended only for checking the operation of undo and redo of the wysiwyg editor.
Only works in Chrome.



### デモ (Demo)

https://wolfeign.github.io/UndoTest/



### 使用方法 (Usage)

通常のエディタと同じように使用できます。
右クリックメニューのアンドゥとリドゥは使えないので、
ツールバーのボタンもしくはCtrl+Z、Ctrl+Yでアンドゥ・リドゥしてください。

画像およびテーブルを選択した際に出るリサイズハンドルをドラッグすればサイズを変更可能です。

It can be used like a normal editor.
Since undo and redo in the right-click menu cannot be used,
undo/redo using the toolbar buttons or Ctrl+Z and Ctrl+Y.

You can change the size by dragging the resize handle that appears when you select an image or table.



### 既知の問題 (Known Issues)

フォントサイズを何回も繰り返すとアンドゥ・リドゥが多少時間がかかる。

リサイズ中にエディタ外にマウスを移動させるとカーソル形状がデフォルトに戻ってしまう。

If you repeat the font size many times, undo/redo takes a little time.

When the mouse is moved outside the editor while resizing, the cursor shape returns to the default.



### 作者 (Author)

wolfeign(@wolfeign)



### ライセンス (License)

The MIT License (MIT)

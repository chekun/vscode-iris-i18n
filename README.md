# iris i18n vscode extension

<div align="center">

</div>

### How to use

- Search "iris i18n" within vscode extensions panel
- install extension
- create and place config file `.iris-i18n.json` inside your iris project folder, put code in it. `locale_path` is the path relative to your project folder, `display_language` is the lang that display in the editor for preview.This file is the trigger for this extension to work.

  ```json
  {
    "locale_path": "./locale",
    "display_language": "zh_CN"
  }
  ```

- currently only supports json file with structure below

  ```bash
  locale_path/
    zh-CN/
      common.json
      error.json
    en-US/
      common.json
      error.json
  ```

- workspaces are supported

- demo screenshot

  <img src="https://github.com/chekun/vscode-iris-i18n/blob/main/assets/screenshot.gif?raw=true" />

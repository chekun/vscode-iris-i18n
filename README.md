# iris i18n vscode extension

<div align="center">

</div>

### How to use

- Search "iris i18n" within vscode extensions panel
- install extension
- place `.iris-i18n.json` inside your iris project folder, put code in it. `locale_path` is the path relative to your project folder.

  ```json
  {
    "locale_path": "./locale"
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

- demo screenshot

  <img src="https://github.com/chekun/vscode-iris-i18n/blob/main/assets/screenshot.jpg?raw=true" />

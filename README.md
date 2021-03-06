# Picup

> Picture compress & upload

## Include

- with \<script\>

    your_page.html

    ```
    <script src="path/to/picup.js"></script>
    ```

- with Vue.js
    install picup package

    ```
    npm install --save-dev picup
    ```

    your_page.vue

    ```
    import Picup from 'picup'
    ```

## Usage

```
Picup(input_file_element, option)
```

## Option

```
{
    'ratio': 1.0,
    'upload': true,
    'showCompressLoading': true,
    'showUploadLoading': true,
    'xhr': {
        'url': '',
        'type': 'POST',
        'fileField': '',
        'otherData': {},
        'success': function success(res) {
            console.log(res);
        },
        'fail': function (xhr) {}
    },
    'hook': {
        'afterInputChange': function () {},
        'beforeReadFile': function (file) {},
        'afterReadFile': function (file) {},
        'beforeCompressImg': function (originBase64Data) {},
        'afterCompressImg': function (base64Data, originBase64Data) {},
        'beforeUploadImg': function (blob, base64Data) {},
        'afterUploadImg': function (blob, base64Data, isAbort) {}
    },
    'errorHandler': function errorHandler(err) {
        console.error(err);
    }
}
```

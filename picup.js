!function (global, factory) {
	'use strict';

	if (typeof module === 'object' && typeof module.exports === 'object') {
		module.exports = global.document ? factory(global) : function (window) {
			return factory(window);
		};
	} else {
		factory(global);
	}
}(
	typeof window !== "undefined" ? window : this,
	function factory(window) {
		'use strict';

		var document = window.document,
			console = window.console,
			DataView = window.DataView,
			Image = window.Image,
			FileReader = window.FileReader,
			atob = window.atob,
			ArrayBuffer = window.ArrayBuffer,
			Uint8Array = window.Uint8Array,
			Blob = window.Blob || window.WebKitBlob || window.MozBlob,
			BlobBuilder = window.WebKitBlobBuilder || window.MozBlobBuilder,
			FormData = window.FormData,
			XMLHttpRequest = window.XMLHttpRequest;

		var JPG_MIME_TYPE = 'image/jpeg';

		var imageCheck = {
			'amount': function amount(files) {
				return files.length === 1;
			},
			'type': function type(file) {
				return /^image\/(jpeg|png|gif|bmp)$/i.test(file.type);
			},
			'size': function size(width, height) {
				return Math.max(width, height) <= 3264
					&& Math.min(width, height) <= 2448
					&& Math.min(width, height) >= PicupClass.tilePadding * 2;
			},
			'ratio': function ratio(width, height) {
				return width / height >= Math.pow(10, -3) && width / height <= Math.pow(10, 3);
			}
		};

		var toQueue = function toQueue(func) {
			return setTimeout(func, 0);
		}

		var processEnd = function processEnd() {
			this.processing = false;

			this.$input.value = '';
		};

		var inputChangeHandler = function inputChangeHandler(target) {
			if (!imageCheck.amount(target.files)) {
				return this.option.errorHandler(new Error('Wrong Image Amount'));
			}
			if (!imageCheck.type(target.files[0])) {
				return this.option.errorHandler(new Error('Wrong Image Type'));
			}

			this.init();

			this.processing = true;
			this.$input = target;

			this.readFile(target.files[0]);
		};

		var $readFile = function $readFile(file) {
			var self = this;

			this.file = file;

			if (!FileReader) {
				processEnd.call(this);
				return this.option.errorHandler(new Error('FileReader NOT Supported'));
			}

			var reader = new FileReader();

			reader.onload = function (e) {
				try {
					self.option.hook.afterReadFile(self.file);
				} catch(ex) {
					console.error(ex);
				}

				readerLoadHandler.call(self, e.target);
			};

			reader.readAsDataURL(this.file);
		};

		var readerLoadHandler = function readerLoadHandler(target) {
			var self = this;

			this.originBase64Data = target.result;

			var originBuffer = getBuffer(this.originBase64Data);
			if (!originBuffer) {
				processEnd.call(this);
				return this.option.errorHandler(new Error('Atob or TypedArray NOT Supported'));
			}

			this.orientation = getOrientation(originBuffer);

			this.$img = createImg(this.originBase64Data);

			if (this.$img.complete) {
				imageReady.call(this);
			} else {
				this.$img.onload = function (e) {
					imageReady.call(self);
				};
			}
		};

		var getBuffer = function getBuffer(base64Data) {
			if (!atob || !ArrayBuffer) {
				return null;
			}

			var binStr = atob(base64Data.split(",")[1]);

			var buffer = new ArrayBuffer(binStr.length);
			var ubuffer = new Uint8Array(buffer);
			for (var i = 0; i < binStr.length; ++i) {
				ubuffer[i] = binStr.charCodeAt(i);
			}
			buffer = ubuffer.buffer;

			return buffer;
		};

		var Exif = {
			'dataView': null,
			'offset': 2,
			'isLittleEnd': false,
			'isJPG': function isJPG() {
				return this.dataView.getUint8(0) === 0xFF && this.dataView.getUint8(1) === 0xD8;
			},
			'setExifOffset': function setExifOffset() {
				while (this.offset < this.dataView.byteLength) {
					if (
						this.dataView.getUint8(this.offset) === 0xFF &&
						this.dataView.getUint8(this.offset + 1) === 0xE1
					) {
						break;
					}

					this.offset++;
				}

				if (this.offset < this.dataView.byteLength) {
					this.offset += 4;
				}
			},
			'getEndian': function getEndian() {
				var endianness = this.dataView.getUint16(this.offset);

				var isLittleEnd = this.isLittleEnd = endianness === 0x4949;
				var isBigEnd = endianness === 0x4D4D;

				return {
					'isLittleEnd': isLittleEnd,
					'isBigEnd': isBigEnd
				};
			},
			'isValidExifData': function isValidExifData() {
				return this.dataView.getUint16(this.offset, this.isLittleEnd) === 0x002A;
			},
			'getFirstIFDOffset': function getFirstIFDOffset() {
				return this.dataView.getUint32(this.offset, this.isLittleEnd);
			},
			'getOrientation': function getOrientation() {
				var orientation = 1;

				var length = this.dataView.getUint16(this.offset, this.isLittleEnd);

				this.offset += 2;

				for (var i = 0; i < length; i++) {
					if (this.dataView.getUint16(this.offset, this.isLittleEnd) === 0x0112) {
						orientation = this.dataView.getUint16(this.offset + 8, this.isLittleEnd);

						break;
					}

					this.offset += 12;
				}

				return orientation;
			}
		};

		var getOrientation = function getOrientation(data) {
			if (!DataView) {
				return 1;
			}

			Exif.dataView = new DataView(data);

			if (!Exif.isJPG()) {
				return 1;
			}

			Exif.offset = 2;

			Exif.setExifOffset();

			if (Exif.offset >= Exif.dataView.byteLength) {
				return 1;
			}

			if (getStringFromCharCode(Exif.dataView, Exif.offset, 4) !== 'Exif') {
				return 1;
			}

			Exif.offset += 6;

			var endian = Exif.getEndian();
			if (!endian.isLittleEnd && !endian.isBigEnd) {
				return 1;
			}

			Exif.offset += 2;

			if (!Exif.isValidExifData()) {
				return 1;
			}

			Exif.offset += 2;

			var firstIFDOffset = Exif.getFirstIFDOffset();
			if (firstIFDOffset < 0x00000008) {
				return 1;
			}

			Exif.offset = Exif.offset - 4 + firstIFDOffset;

			return Exif.getOrientation();
		};

		var getStringFromCharCode = function getStringFromCharCode(dataView, offset, length) {
			var res = '';

			for (var i = 0; i < length; i++) {
				res += String.fromCharCode(dataView.getUint8(offset + i));
			}

			return res;
		};

		var createImg = function createImg(data) {
			var $img = new Image();
			$img.src = data;

			return $img;
		};

		var imageReady = function imageReady() {
			if (!imageCheck.size(this.$img.width, this.$img.height)) {
				console.warn('Picup - Bad Image Size.');
			}
			if (!imageCheck.ratio(this.$img.width, this.$img.height)) {
				console.warn('Picup - Bad Image Aspect Ratio.');
			}

			this.compressImg();
		};

		var $compressImg = function $compressImg() {
			this.option.showCompressLoading && this.compressLoading(true);

			var sizeObj = calcSize(this.$img.width, this.$img.height, 4000000);

			this.$canvas = createCanvas(sizeObj.width, sizeObj.height);

			drawImg.call(this, sizeObj.width, sizeObj.height, sizeObj.ratio);

			this.base64Data = getCompressedData.call(this);

			if (this.base64Data.length > this.originBase64Data.length) {
				this.base64Data = this.originBase64Data;
			}

			this.option.showCompressLoading && this.compressLoading(false);

			try {
				this.option.hook.afterCompressImg(this.base64Data, this.originBase64Data);
			} catch(ex) {
				console.error(ex);
			}

			compressReady.call(this);
		};

		var $compressLoading = function $compressLoading(isShow) {
			if (isShow) {
				console.log('Picup - Compressing');
			} else {
				console.log('Picup - Compressing complete');
			}
		};

		var calcSize = function calcSize(width, height, pixel, isTile) {
			var ratio = width * height / pixel;

			if (ratio > 1) {
				ratio = isTile ? ~~Math.sqrt(ratio) + 1 : Math.sqrt(ratio);
				width = isTile ? ~~(width / ratio) + PicupClass.tilePadding * 2 : width / ratio;
				height = isTile ? ~~(height / ratio) + PicupClass.tilePadding * 2 : height / ratio;
			} else {
				ratio = 1;
			}

			return {
				'width': width,
				'height': height,
				'ratio': ratio
			};
		};

		var createCanvas = function createCanvas(width, height) {
			var $canvas = document.createElement('canvas');

			$canvas.width = width;
			$canvas.height = height;

			var context = $canvas.getContext('2d');

			clearRectJPG(context, width, height);

			return $canvas;
		};

		var clearRectJPG = function clearRectJPG(context, width, height) {
			context.fillStyle = '#ffffff';
			context.fillRect(0, 0, width, height);
		};

		var drawImg = function drawImg(width, height, ratio) {
			var context = this.$canvas.getContext('2d');

			var currTilePadding = ~~Math.min(
				width / 2,
				height / 2,
				PicupClass.tilePadding
			);

			var sizeObj = calcSize(width, height, 1000000, true);

			if (sizeObj.ratio > 1) {
				var $canvasInner = null,
					contextInner = null;

				var count = ~~sizeObj.ratio;

				for (var i = 0; i < count; i++) {
					for (var j = 0; j < count; j++) {
						$canvasInner = createCanvas(sizeObj.width, sizeObj.height),
						contextInner = $canvasInner.getContext('2d');

						contextInner.drawImage(
							this.$img,
							Math.min(
								Math.max(
									(i * (sizeObj.width - currTilePadding * 2) - currTilePadding) * ratio,
									0
								),
								this.$img.width - sizeObj.width * ratio
							),
							Math.min(
								Math.max(
									(j * (sizeObj.height - currTilePadding * 2) - currTilePadding) * ratio,
									0
								),
								this.$img.height - sizeObj.height * ratio
							),
							sizeObj.width * ratio,
							sizeObj.height * ratio,
							0,
							0,
							sizeObj.width,
							sizeObj.height
						);

						context.drawImage(
							$canvasInner,
							Math.min(
								Math.max(
									i * (sizeObj.width - currTilePadding * 2) - currTilePadding,
									0
								),
								width - sizeObj.width
							),
							Math.min(
								Math.max(
									j * (sizeObj.height - currTilePadding * 2) - currTilePadding,
									0
								),
								height - sizeObj.height
							),
							sizeObj.width,
							sizeObj.height
						);
					}
				}

				$canvasInner = null;
			} else {
				context.drawImage(this.$img, 0, 0, width, height);
			}

			if (this.orientation === 3 || this.orientation === 6 || this.orientation === 8) {
				rotateByOrientation.call(this, width, height);
			}
		};

		var rotateByOrientation = function rotateByOrientation(width, height) {
			var widthTemp = this.orientation === 3 ? width : height,
				heightTemp = this.orientation === 3 ? height : width;

			var $canvasTemp = createCanvas(widthTemp, heightTemp),
				contextTemp = $canvasTemp.getContext('2d');

			var matrixObj = {
				'1': [1, 0, 0, 1, 0, 0],
				'3': [-1, 0, 0, -1, 0, 0],
				'6': [0, 1, -1, 0, 0, 0],
				'8': [0, -1, 1, 0, 0, 0],
				'*': [1, 0, 0, 1, 0, 0]
			};

			var currMatrix = matrixObj[this.orientation] || matrixObj['*'];
			contextTemp.setTransform.apply(contextTemp, currMatrix);
			contextTemp.drawImage(
				this.$canvas,
				Math.min(0, widthTemp * currMatrix[0] + heightTemp * -currMatrix[2] + -currMatrix[4]),
				Math.min(0, widthTemp * -currMatrix[1] + heightTemp * currMatrix[3] + -currMatrix[5]),
				Math.abs(widthTemp * currMatrix[0] + heightTemp * -currMatrix[2] + -currMatrix[4]),
				Math.abs(widthTemp * -currMatrix[1] + heightTemp * currMatrix[3] + -currMatrix[5])
			);
			contextTemp.setTransform(1, 0, 0, 1, 0, 0);

			this.$canvas = $canvasTemp;
		};

		var getCompressedData = function getCompressedData() {
			return this.$canvas.toDataURL(JPG_MIME_TYPE, this.option.ratio);
		};

		var compressReady = function compressReady() {
			if (!this.option.upload) {
				return processEnd.call(this);
			}

			var buffer = getBuffer(this.base64Data);

			this.blob = getBlob(buffer, JPG_MIME_TYPE);

			if (!this.blob) {
				processEnd.call(this);
				return this.option.errorHandler(new Error('Blob or BlobBuilder NOT Supported'));
			}

			this.uploadImg();
		}

		var getBlob = function getBlob(buffer, jpgType) {
			var blob = null;

			if (Blob) {
				blob = new Blob([
					buffer
				], {
					'type': jpgType
				});
			} else if (BlobBuilder) {
				var builder = new BlobBuilder();
				builder.append(buffer);
				blob = builder.getBlob(jpgType);
			}

			return blob;
		};

		var $uploadImg = function $uploadImg() {
			var self = this;

			var formData = getFormData.call(this, this.blob);
			if (!formData) {
				processEnd.call(this);
				return this.option.errorHandler(new Error('FormData NOT Supported'));
			}

			this.option.showUploadLoading && this.uploadLoading(true, 0);

			this.xhr = new XMLHttpRequest();
			this.xhr.upload.onprogress = function (e) {
				self.progress = e.lengthComputable ? e.loaded / e.total * 49 : 0;

				self.option.showUploadLoading && self.uploadLoading(true, self.progress, !e.lengthComputable);
			};
			this.xhr.onprogress = function (e) {
				self.progress = 50 + e.loaded / e.total * 50;

				self.option.showUploadLoading && self.uploadLoading(true, self.progress);
			};
			this.xhr.open(this.option.xhr.type, this.option.xhr.url);
			this.xhr.onreadystatechange = function () {
				if (self.xhr.readyState === 4) {
					if (self.xhr.status === 200) {
						self.option.showUploadLoading && self.uploadLoading(false, 100);

						self.option.xhr.success(self.xhr.responseText);
					} else {
						self.option.xhr.fail(self.xhr);
					}

					try {
						self.option.hook.afterUploadImg(self.blob, self.base64Data);
					} catch(ex) {
						console.error(ex);
					}

					processEnd.call(self);
				}
			};
			this.xhr.send(formData);
		};

		var $uploadLoading = function $uploadLoading(isShow, progress, isFake) {
			if (isShow) {
				console.log('Picup - Uploading %d%', progress);
			} else {
				console.log('Picup - Uploading complete');
			}
		};

		var getFormData = function getFormData(blob) {
			if (!FormData) {
				return null;
			}

			var formData = new FormData();

			formData.append(
				this.option.xhr.fileField,
				blob,
				this.file.name.replace(/\.[^.]+$/, '.' + getHash.call(this, this.base64Data) + '.jpg')
			);

			for (var i in this.option.xhr.otherData) {
				formData.append(i, this.option.xhr.otherData[i]);
			}

			return formData;
		};

		var getHash = function getHash(input) {
			var I64BIT_TABLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'.split('');

			var hash = parseInt('001010100000101', 2);
			var i = input.length - 1;

			var isInputString = typeof input === 'string';
			for (; i > -1; i--) {
				hash += hash << 5 + (isInputString ? input.charCodeAt(i) : input[i]);
			}

			var value = hash & (Math.pow(2, 31) - 1);

			var result = '';
			do {
				result += I64BIT_TABLE[value & (I64BIT_TABLE.length - 1)];
			} while (value >>= 3);

			return result;
		};

		var PicupClass = function PicupClass(option) {
			this.option = this.defaultOption = {
				'ratio': 1.0,
				'upload': true,
				'showCompressLoading': true,
				'showUploadLoading': true,
				'xhr': {
					'url': '',
					'type': 'POST',
					'fileField': 'file',
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
			};
			for (var i in option) {
				this.option[i] = option[i];
			}

			PicupClass.validateOption.call(this, PicupClass.validateRule, this.option, this.defaultOption);

			this.init();
		};

		PicupClass.validateRule = {
			'ratio': function (value) {
				return typeof value === 'number' && value > 0 && value <= 1;
			},
			'upload': function (value) {
				return typeof value === 'boolean';
			},
			'showCompressLoading': function (value) {
				return typeof value === 'boolean';
			},
			'showUploadLoading': function (value) {
				return typeof value === 'boolean';
			},
			'xhr': {
				'url': function (value) {
					return typeof value === 'string' && value !== '';
				},
				'type': function (value) {
					return typeof value === 'string' && ['POST', 'PUT'].indexOf(value.toUpperCase());
				},
				'fileField': function (value) {
					return typeof value === 'string' && value !== '';
				},
				'otherData': function (value) {
					return typeof value === 'object' && Object.prototype.toString.call(value) === '[object Object]';
				},
				'success': function (value) {
					return typeof value === 'object' && value instanceof Function;
				},
				'fail': function (value) {
					return typeof value === 'object' && value instanceof Function;
				}
			},
			'hook': {
				'afterInputChange': function (value) {
					return typeof value === 'object' && value instanceof Function;
				},
				'beforeReadFile': function (value) {
					return typeof value === 'object' && value instanceof Function;
				},
				'afterReadFile': function (value) {
					return typeof value === 'object' && value instanceof Function;
				},
				'beforeCompressImg': function (value) {
					return typeof value === 'object' && value instanceof Function;
				},
				'afterCompressImg': function (value) {
					return typeof value === 'object' && value instanceof Function;
				},
				'beforeUploadImg': function (value) {
					return typeof value === 'object' && value instanceof Function;
				},
				'afterUploadImg': function (value) {
					return typeof value === 'object' && value instanceof Function;
				}
			},
			'errorHandler': function (value) {
				return typeof value === 'object' && value instanceof Function;
			}
		};

		PicupClass.validateOption = function validateOption(validateRule, option, defaultOption) {
			for (var i in validateRule) {
				if (
					typeof validateRule[i] === 'object' &&
					Object.prototype.toString.call(validateRule[i]) === '[object Object]'
				) {
					if (
						typeof option[i] !== 'object' ||
						Object.prototype.toString.call(option[i]) !== '[object Object]'
					) {
						option[i] = defaultOption[i];

						continue;
					}

					PicupClass.validateOption(validateRule[i], option[i], defaultOption[i]);

					continue;
				}

				if (!validateRule[i](option[i])) {
					option[i] = defaultOption[i];
				}
			}
		};

		PicupClass.tilePadding = 5;

		PicupClass.prototype.init = function init() {
			this.processing = false;
			this.$input = null;
			this.file = null;
			this.$img = null;
			this.$canvas = null;
			this.base64Data = '';
			this.originBase64Data = '';
			this.blob = null;
			this.xhr = null;
			this.progress = 0;
		};

		PicupClass.prototype.readFile = function readFile(file) {
			var self = this;

			try {
				this.option.hook.beforeReadFile(file);
			} catch(ex) {
				console.error(ex);
			}

			toQueue(function readFileToQueue() {
				$readFile.call(self, file);
			});
		};

		PicupClass.prototype.compressImg = function compressImg() {
			var self = this;

			try {
				var compressContinue = this.option.hook.beforeCompressImg(this.originBase64Data);

				if (compressContinue === false) {
					this.base64Data = this.originBase64Data;

					return this.option.hook.afterCompressImg(this.base64Data, this.originBase64Data);
				}
			} catch(ex) {
				return console.error(ex);
			}

			toQueue(function compressImgToQueue() {
				$compressImg.call(self);
			});
		};

		PicupClass.prototype.uploadImg = function uploadImg() {
			var self = this;

			try {
				var uploadContinue = this.option.hook.beforeUploadImg(this.blob, this.base64Data);
				if (uploadContinue === false) {
					this.option.hook.afterUploadImg(this.blob, this.base64Data, true);

					return processEnd.call(this);
				}
			} catch(ex) {
				return console.error(ex);
			}

			toQueue(function uploadImgToQueue() {
				$uploadImg.call(self);
			});
		};

		PicupClass.prototype.compressLoading = function compressLoading(isShow) {
			$compressLoading.call(this, isShow);
		};

		PicupClass.prototype.uploadLoading = function uploadLoading(isShow, progress, isFake) {
			$uploadLoading.call(this, isShow, progress, isFake);
		};

		var Picup = function Picup($input, option) {
			var self = $input._PicupInstance = new PicupClass(option);
			console.log('Picup option: %o', $input._PicupInstance.option);

			$input.addEventListener('change', function (e) {
				if (self.processing) {
					return false;
				}
				if (!e.target.files.length) {
					return;
				}

				try {
					self.option.hook.afterInputChange();
				} catch(ex) {
					console.error(ex);
				}

				toQueue(function inputChangeToQueue() {
					inputChangeHandler.call(self, e.target);
				});
			});
		};

		window.Picup = Picup;
		return Picup;
	}
);

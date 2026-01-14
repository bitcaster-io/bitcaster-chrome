CHROME?=chrome

help:
	@echo "build: build extensions"
	@echo "dist: build distribution"

build: key.pem
	"${CHROME}" --pack-extension=./src --pack-extension-key=key.pem && mv src.crx os4d-bitcaster.crx

dist: build
	zip -r os4d-bitcaster.zip src/*

key.pem:
	openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out key.pem
	openssl rsa -in key.pem -pubout -outform DER | openssl base64 -A
	openssl rsa -in key.pem -pubout -outform DER | shasum -a 256 | head -c32 | tr 0-9a-f a-p

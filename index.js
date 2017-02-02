const shoppingCartHash = process.argv[2];
if (shoppingCartHash === undefined) {
	throw new Error('Please provide the shopping cart hash as an argument. E.g. `node index 123456789`');
}

const https = require('https');
const configuration = require('./configuration.json');
const shoppingCart = require('./dummy_shopping_cart_data.json');
const creditCard = require('./dummy_credit_card_data.json');

global.navigator = {};
global.window = {};
const adyen = require('adyen-cse-js');

/**
 * This request is made to get the public key for encrypting payment information.
 * It won't be necessary later when you have the key in your system.
 */
function requestPaymentConfiguration() {
	let getPublicKey = (apiResponseData) => {
		let publicKey = '';

		apiResponseData.data.payment_methods.forEach((value) => {
			if (value.name === 'encrypted_credit_card') {
				publicKey = value.public_key;
			}
		});

		return publicKey;
	};

	const requestOptions = {
		hostname: configuration.hostName,
		port: 443,
		path: '/1/configuration/payment?cnt_language=en&currency=USD&country=DE',
		method: 'GET',
		headers: {
			'X-ACCESS-TOKEN': configuration.accessToken,
			'Accept': 'application/json'
		}
	};

	https
		.request(requestOptions, (res) => {
			let str = '';
			res
				.setEncoding('utf8')
				.on('data', (chunk) => str += chunk)
				.on('error', (e) => console.error(error.message))
				.on('end', () => {
					let res = JSON.parse(str);
					let publicKey = getPublicKey(res);
					confirmShoppingCart(publicKey)
				});
		})
		.end();
}

/**
 * This request is made to post the payment information and confirm the shopping cart.
 * @param publicKey
 */
function confirmShoppingCart(publicKey) {
	let requestOptions = {
		hostname: configuration.hostName,
		port: 443,
		path: '/1/carts',
		method: 'POST',
		headers: {
			'X-ACCESS-TOKEN': configuration.accessToken,
			'Accept': 'application/json',
			'Content-Type': 'application/json'
		}
	};

	// Include the time the data gets encrypted
	creditCard.generationtime = new Date().toISOString();

	// Pass it through the Adyen library
	let cseInstance = adyen.createEncryption(publicKey, {});
	let encryptedData = cseInstance.encrypt(creditCard);

	// Update the dummy payment data with the shopping cart hash and the encrypted credit card data.
	shoppingCart.data.shopping_cart.shopping_cart_hash = shoppingCartHash; // Get this from: https://gyg:test@www-getyourguide-com.partner.gygtest.com/?partner_id=0I83F7M
	shoppingCart.data.shopping_cart.payment.encrypted_credit_card.data = encryptedData;

	let postData = JSON.stringify(shoppingCart);
	requestOptions.headers["Content-Length"] = Buffer.byteLength(postData);

	https
		.request(requestOptions, (res) => {
			let str = '';
			res
				.setEncoding('utf8')
				.on('data', (chunk) => str += chunk)
				.on('error', (e) => console.error(error.message))
				.on('end', () => {
					let res = JSON.parse(str);
					console.log(JSON.stringify(res));
				})
		})
		.end(postData);
}

requestPaymentConfiguration();

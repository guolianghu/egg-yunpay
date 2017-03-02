/**
 * Created by huguoliang on 2017/3/1.
 */
'use strict';

const request = require('request');
const _ = require('underscore');

const crypto = require('crypto');

function getSign(sign_method, data, key = '', output = 'base64') {
    switch (sign_method) {

        case 'rsa':
            return getRsaSign(data, key, output);
            break;

        case 'm5d':
            const hash = crypto.createHash(sign_method);
            return hash.update(data).digest(output);
            break;
    }

    return '';
}

function getRsaSign(str, key, output = 'base64') {
    const sign = crypto.createSign('RSA-SHA1');
    sign.update(str, 'utf8');

    return sign.sign(key, output);
}

class YunPay {
    constructor(config) {

        /**
         * @type {string}
         */
        this.partner = config.partner;

        /**
         * @type {string}
         */
        this.secret = config.secret;

        /**
         * 网关地址
         * @type {string}
         */
        this.gate = config.gate_url;

        /**
         * 终端类型
         * @type {string}
         */
        this.terminalType = config.terminalType;

        /**
         * 版本号
         * @type {string}
         */
        this.version = config.version || 'v1.1';

        //签名算法
        this.sign_method = _.indexOf(['md5', 'rsa']) > -1 ? config.method: 'rsa';
    }


    /**
     * 计算签名值
     * @param body
     * @return {string}
     * @private
     */
    _getSign(body) {
        let append_key = this.secret;
        switch (this.sign_method) {
            case 'rsa':
                append_key = append_key.replace('-----BEGIN PRIVATE KEY-----', '');
                append_key = append_key.replace('-----END PRIVATE KEY-----', '');
                append_key = append_key.replace(/\n/g, '');
                break;
        }
        return getSign(this.sign_method, body + append_key, this.secret);
    }

    /**
     *  发生请求
     * @param service
     * @param data
     * @return {Promise}
     * @private
     */
    _sendRequest(service, data) {
        const {partner, version, terminalType} = this;

        var rst = new Promise( (resolve, reject) => {
            const data = _.extend({}, data, {service, terminalType});
            const body = JSON.stringify(data);

            const headers = {
                partner,
                version,
                sign: this._getSign(body),
            };

            request(this.gate, {
                method: 'POST',
                json: true,
                headers,
                body,
            }, function (error, response, body) {
                if (error) {
                    reject(error);
                    return;
                }

                resolve(body);
            });
        });


        return rst;
    }

    /**
     * 查询余额
     * @param memberId
     * @return {Promise}
     */
    queryAccount(memberId) {
        return this._sendRequest('queryAccount', {
            memberId,
            requestTime: Date.now(),
        });
    }

}

// var config = {
//     secret: `-----BEGIN PRIVATE KEY-----
// MIICeQIBADANBgkqhkiG9w0BAQEFAASCAmMwggJfAgEAAoGBAPEBsXk4x2WP828j
// m2KiGCPn03VHwyAkomN11IKLMMUlCZdTsv3aJcN36R+VmmXyvv8ZWzBgpAYuGeby
// TKtf791rD5SvmJqcSO5doyUkWcVmRokY1YvH6h2SctZhad9QwR+9TLmRLbE0FeI/
// P0aPA2aAiPYd54GesgyxKaATjTybAgMBAAECgYEAplzL3GjUQ4hNux8yKLDJxydE
// 8YU67Vo8ejmhGwfn/35kk4AkY1UNklOYqcPEU7FwJHmlV8yuDNIP8Tq6r+XGlZNN
// 8fc2BQ8RuCdASpJ21wrDVJdpy/gAs5hylAXkod0Fa5Pf6Yegu2YtKwKaVI/DzNaI
// IG/Zebnye13KAQuNPOkCQQD9gc09SkHQPcymhKtzcE9hPbWAo656Xo2/WaNaMQyu
// eeA/Qe7gJ0jDxwZMOXWee84Km/8ndNudtXCgS/GdS7L1AkEA82BsCGaqwOE+Zm1d
// vODIfPRSlIgEnyLXedXCpZHFDItAo7F54VsMB8wn8W4/wBUUeNzfA78hR3djOKsH
// u4kXTwJBAOagff1yXul6L4KWU/xTgoPuxf7f6k29U6tveyMEWIsqqY4jB5S5aINj
// vyD9bTnfXBVe0gQtVdbmSC4sqQT25zkCQQC0KgXvdikjndq2snF4+CIStj9HqyVY
// tM80ZvSv4qgvcAqK4z/pfp/6Sbyr8kSJKlG8Yy1Itb2qDQxLj/iqcILrAkEAqvOf
// jxgWL4mx3MVvyAKHXTry4Wa1gZV3bZJqtSMnm9JDg3Nv8cn90CcUS2/saLZMefzi
// J7EVb//0WNqBu+QmWg==
// -----END PRIVATE KEY-----`
// }
// var sdk = new YunPay(config);
//
// var data = `{"memberId":"111","requestTime":1488482029805,"service":"queryAccount","terminalType":"JSAPI"}`;
// console.log(sdk._getSign(data));

module.exports = YunPay;

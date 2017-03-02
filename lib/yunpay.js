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
    sign.update(str, 'utf-8');

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
        console.log('append_key', append_key);
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
            const body = _.extend({}, data, {service, terminalType});
            const rawBody = JSON.stringify(body);

            const headers = {
                partner,
                version,
                sign: this._getSign(rawBody),
            };

            request(this.gate, {
                method: 'POST',
                json: true,
                headers,
                rawBody,
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

module.exports = YunPay;

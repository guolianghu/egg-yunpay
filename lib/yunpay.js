/**
 * Created by huguoliang on 2017/3/1.
 */
'use strict';

const request = require('request');
const _ = require('underscore');

const crypto = require('crypto');

function getSign(str, sign_method, output = 'hex') {
    const hash = crypto.createHash(sign_method);
    return hash.update(str).digest(output);
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
         * 版本号
         * @type {string}
         */
        this.version = config.version || 'v1.1';

        //签名算法
        this.sign_method = _.indexOf(['md5', 'rsa']) > -1 ? config.method: 'md5';
    }


    /**
     * 计算签名值
     * @param body
     * @return {string}
     * @private
     */
    _getSign(body) {
        return getSign(body + this.secret, this.sign_method);
    }

    /**
     *  发生请求
     * @param service
     * @param data
     * @return {Promise}
     * @private
     */
    _sendRequest(service, data) {
        const {partner, version} = this;

        return new Promise( (resolve, reject) => {
            const body = _.extend({}, data, {service});
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
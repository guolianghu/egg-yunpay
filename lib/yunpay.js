/**
 * Created by huguoliang on 2017/3/1.
 */
'use strict';

const request = require('request');
const _ = require('underscore');

class YunPay {
    constructor(config) {

        /**
         * @type {string}
         */
        this.appid = config.appid;

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

        /**
         * @type {string}
         */
        this.partner = config.partner;
    }

    /**
     * 计算签名值
     * @param body
     * @return {string}
     * @private
     */
    _getSign(body) {
        return "";
    }

    /**
     *  发生请求
     * @param service
     * @param data
     * @return {Promise}
     * @private
     */
    _sendRequest(service, data) {
        return new Promise(function (resolve, reject) {
            const body = _.extend({}, data, {service});

            const headers = {
                partner: this.partner,
                version: this.version,
                sign: this._getSign(body),
            };

            request(this.gate, {
                method: 'POST',
                json: true,
                headers,
                form: body,
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
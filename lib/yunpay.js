/**
 * Created by huguoliang on 2017/3/1.
 */ 'use strict';

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
        let append_key = '';
        // let append_key = this.secret;
        // switch (this.sign_method) {
        //     case 'rsa':
        //         append_key = append_key.replace('-----BEGIN PRIVATE KEY-----', '');
        //         append_key = append_key.replace('-----END PRIVATE KEY-----', '');
        //         append_key = append_key.replace(/\n/g, '');
        //         break;
        // }
        return getSign(this.sign_method, body + append_key, this.secret);
    }

    /**
     *  发生请求
     * @param service
     * @param data
     * @param returnBody
     * @return {Promise}
     * @private
     */
    _sendRequest(service, data, returnBody) {

        returnBody = returnBody || false;

        const {partner, version, terminalType} = this;

        var rst = new Promise( (resolve, reject) => {
            const body = JSON.stringify(_.extend({}, data, {service, terminalType}));

            const headers = {
                partner,
                version,
                sign: this._getSign(body),
                'content-type': 'application/json',
            };

            request(this.gate, {
                method: 'POST',
                //json: true,
                headers,
                body,
            }, function (error, response, ret_body) {
                if (error) {
                    reject(error);
                    return;
                }

                let resp_rst;
                try {
                    resp_rst = JSON.parse(ret_body);
                }catch(e) {
                   return reject(e); 
                }

                // 是否需要返回 Body
                if(returnBody) {
                    resolve({
                        body,
                        sign: headers.sign,
                        result: resp_rst
                    });
                }else {
                    resolve(resp_rst);
                }

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

    /**
     * 获取工作密钥
     * @param memberId
     * @return {Promise}
     */
    getWorkingToken(memberId, expiryTime = Date.now() + 3600*24) {
        return this._sendRequest('getWorkingKey', {
            memberId,
            requestTime: Date.now(),
            expiryDate: expiryTime,
        });
    }

    /**
     * 创建收款订单（卖家支付保证金, 买家支付保证金, 支付尾款）
     *
     * @param businessId 业务号(根据业务传入参数对象)
     * @param params    参数对象
     * +===============================+
     *  traceNO 流水号（唯一）
     *  amount  订单金额
     *  describe 付款原因
     *  payer 付款人
     *  notifyUrl 支付结果（后台）通知地址
     *  returnUrl 付款完成（前台）跳转地址
     *  orderNO 订单号（与业务订单关联的信息）
     *  expiryTime 过期时间(默认：1天)
     * +===============================+
     *
     * @return {Promise}
     */
    createPaymentOrder(businessId, params) {

        params.businessId = businessId;
        params.requestTime = Date.now();
        params.expiryTime = params.expiryTime || Date.now() + 3600*24;

        return this._sendRequest('acquirer', params, true);
    }

 
    /**
     * 退还保证金（拍品保证金退还, 叫价保证金退还, 红包余额退还）
     *
     * @param traceNO 流水号（唯一）
     * @param payers  会员订单号(多个以逗号分隔)
     * @param amounts 解冻金额(多个以逗号分隔)（单位：元）
     * @param describe 解冻原因
     * @param receiptIds 冻结凭证号(多个以逗号分隔)
     * @param orderNO 订单号（与业务订单关联的信息）
     *
     * @return {Promise}
     */
    refundDeposit(traceNO, payers, amounts, describe, receiptIds, orderNO) {

        orderNO = orderNO || "";

        let params = {
            traceNO,
            payers,
            amounts,
            describe,
            receiptIds,
            orderNO,
        };

        return this._sendRequest('refundDeposit', params);
    }

  
    /**
     * 转账
     *（买家违约赔付保证金, 买家违约赔付卖家红包余额, 卖家违约违约赔付保证金, 货款合并，全额付款）
     *
     * @param businessId 业务号
     * @param traceNO 流水号（唯一）
     * @param payer 卖家会员号
     * @param payerReceiptId 付款凭证号
     * @param payees 收款会员号（多个会员用英文逗号,分开）
     * @param payeeAmounts 收款金额（多个会员用英文逗号,分开）（单位：元）
     * @param describe 原因
     * @param orderNO 订单号（与业务订单关联的信息）
     *
     * @return {Promise}
     */
    transfer(businessId, traceNO, payer, payerReceiptId, payees, payeeAmounts, describe, orderNO) {

        orderNO = orderNO || "";

        let params = {
            traceNO,
            payers,
            amounts,
            describe,
            receiptIds,
            orderNO,
        };

        return this._sendRequest('transfer', params);
    }

    /**
     * 验证签名
     * param body   验证内容
     * param sign   签名
     * @return bool 
     */
    verifySign(body, sign) {

        const signStr = this._getSign(body);
        if(signStr != sign) {
            return false;
        }

        return true;
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

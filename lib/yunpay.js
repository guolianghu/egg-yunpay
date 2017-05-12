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

function getRsaDecrypt(str, key, charset = 'utf8') {

  var buffer = new Buffer(str, 'base64');
  var dec = crypto.privateDecrypt({
    key: key,
    padding: crypto.constants.RSA_PKCS1_PADDING,
  }, buffer);

  return dec.toString(charset);
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
     * 公钥
     * @type {string}
     */
    this.publicKey = config.publicKey;

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
    this.sign_method = _.indexOf(['md5', 'rsa']) > -1 ? config.method : 'rsa';

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
   * 获取 RSA解密内容
   * @param body
   * @return {string}
   * @private
   */
  getDecrypt(str) {
    return getRsaDecrypt(str, this.secret);
  }

  /**
   * 使用公钥加密数据
   * @param str
   * @return {String}
   */
  encrypt(str, output_encoding = 'base64') {
    const encrypted = crypto.publicEncrypt(this.publicKey, new Buffer(str));

    return encrypted.toString(output_encoding);
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

    var rst = new Promise((resolve, reject) => {
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
        } catch (e) {
          return reject(e);
        }

        resolve(resp_rst);
      });
    });

    return rst;
  }

  /**
   * 构造收款订单
   * @param service
   * @param data
   * @return {Promise}
   * @private
   */
  _createPaymentOrder(service, data) {

    const {terminalType} = this;

    let result = {};

    result.body = JSON.stringify(_.extend({}, data, {service, terminalType}));
    result.sign = this._getSign(result.body);

    return result;
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
   * 快捷支付
   * @param memberId
   * @param amount
   * @return {Promise}
   */
  recharge(memberId, amount) {
    return this._sendRequest('recharge', {
      memberId,
      amount,
      requestTime: Date.now(),
    });
  }


  /**
   * 获取工作密钥
   * @param memberId
   * @return {Promise}
   */
  getWorkingToken(memberId, expiryTime = Date.now() + 3600 * 24) {
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
   *  expiryTime 过期时间(默认：半小时)
   * +===============================+
   *
   * @return {Promise}
   */
  createPaymentOrder(businessId, params) {

    params.businessId = businessId;
    params.requestTime = Date.now();
    params.expiryTime = params.expiryTime || Date.now() + 1800;

    return this._createPaymentOrder('acquirer', params);
  }

  /**
   * 创建退款订单 退还保证金（拍品保证金退还, 叫价保证金退还, 红包余额退还）
   *
   * @param params    参数对象
   * +=====================================+
   *  traceNO 流水号（唯一）
   *  receiptId 凭证号
   *  amount 订单金额
   *  describe 退款原因
   *  notifyUrl 支付结果（后台）通知地址
   *  orderNO 原订单号（与业务订单关联的信息）
   * +=====================================+
   *
   * @return {Promise}
   */
  createRefundOrder(params) {

    params.requestTime = Date.now();
    return this._sendRequest('refund', params, true);
  }

  /**
   * 转账
   *（买家违约赔付保证金, 买家违约赔付卖家红包余额, 卖家违约违约赔付保证金, 货款合并，全额付款）
   *
   * @param businessId 业务号
   * @param params    参数对象
   *
   * +===== 基本户专基本户（支持批量）======+
   *  traceNO 流水号（唯一）
   *  orderNO 订单号（与业务订单关联的信息）
   *  payer 卖家会员号
   *  payerReceiptId 付款凭证号
   *  payees 收款会员号（多个会员用英文逗号,分开）
   *  payeeAmounts 收款金额（多个会员用英文逗号,分开）（单位：元）
   *  describe 原因
   * +=====================================+
   *
   * @return {Promise}
   */
  transfer(businessId, params) {

    params.businessId = businessId;
    params.requestTime = Date.now();

    return this._sendRequest('transfer', params);
  }

  /**
   * 验证签名
   * @param body   验证内容
   * @param sign   签名
   * @param encoding 签名的编码
   * @return boolean
   */
  verifySign(body, sign, enconding = 'base64') {
    const verify = crypto.createVerify('RSA-SHA1');
    verify.update(body);

    return verify.verify(this.publicKey, sign, enconding);
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

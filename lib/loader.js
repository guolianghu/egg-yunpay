/**
 * Created by huguoliang on 2017/3/1.
 */
'use strict';

const YunPay = require('./yunpay');
// const assert = require('assert');

module.exports = app => {
    app.addSingleton('yunpay', (config, app) => {
        return new YunPay(config);
    })
}
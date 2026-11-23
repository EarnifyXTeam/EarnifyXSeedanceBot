import crypto from 'crypto';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';

const DATA_DIR = path.resolve('data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let orders = {};
try {
  if (fs.existsSync(ORDERS_FILE)) {
    orders = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf-8'));
  }
} catch (e) {
  orders = {};
}

function saveOrders() {
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving orders.json:', e);
  }
}

function generateNonce(length = 32) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function buildBinanceSignature(timestamp, nonce, bodyString, secretKey) {
  const payload = `${timestamp}\n${nonce}\n${bodyString}\n`;
  return crypto.createHmac('sha512', secretKey).update(payload).digest('hex').toUpperCase();
}

export class BinancePayService {
  /**
   * Check if official Binance Merchant API keys are configured
   */
  static isApiConfigured() {
    return !!(config.binancePayApiKey && config.binancePaySecretKey);
  }

  /**
   * Create an automated Binance Pay Order via Official API
   */
  static async createOrder({ userId, username, amount, planName, credits = 5 }) {
    const merchantTradeNo = `PAY_${userId}_${Date.now()}`;
    const timestamp = Date.now().toString();
    const nonce = generateNonce(32);

    const bodyObj = {
      env: {
        terminalType: 'APP',
      },
      merchantTradeNo,
      orderAmount: parseFloat(amount).toFixed(2),
      currency: 'USDT',
      goods: {
        goodsType: '02',
        goodsCategory: 'Z000',
        referenceGoodsId: planName,
        goodsName: `EarnifyX Seedance Access (${planName})`,
        goodsDetail: `EarnifyX AI Video Generation: ${credits} credits / access`,
      },
    };

    const orderRecord = {
      merchantTradeNo,
      userId: userId.toString(),
      username: username || '',
      amount: parseFloat(amount).toFixed(2),
      currency: 'USDT',
      planName,
      credits,
      status: 'INITIAL',
      createdAt: new Date().toISOString(),
      checkoutUrl: null,
      prepayId: null,
    };

    if (this.isApiConfigured()) {
      try {
        const bodyStr = JSON.stringify(bodyObj);
        const signature = buildBinanceSignature(timestamp, nonce, bodyStr, config.binancePaySecretKey);

        const response = await axios.post(
          'https://bpay.binanceapi.com/binancepay/openapi/v2/order',
          bodyObj,
          {
            headers: {
              'Content-Type': 'application/json',
              'BinancePay-Timestamp': timestamp,
              'BinancePay-Nonce': nonce,
              'BinancePay-Certificate-SN': config.binancePayApiKey,
              'BinancePay-Signature': signature,
            },
            timeout: 15000,
          }
        );

        if (response.data?.status === 'SUCCESS' && response.data?.data) {
          const data = response.data.data;
          orderRecord.prepayId = data.prepayId;
          orderRecord.checkoutUrl = data.checkoutUrl || data.universalUrl || data.deeplink;
          orderRecord.qrContent = data.qrContent;
          orderRecord.expireTime = data.expireTime;
        } else {
          console.warn('⚠️ Binance Pay API returned non-success:', response.data);
        }
      } catch (err) {
        console.error('❌ Binance Pay Order API error:', err.response?.data || err.message);
      }
    }

    orders[merchantTradeNo] = orderRecord;
    saveOrders();
    return orderRecord;
  }

  /**
   * Query Binance Pay Order Status via API
   */
  static async queryOrderStatus(merchantTradeNo) {
    const order = orders[merchantTradeNo];
    if (!order) return { status: 'NOT_FOUND' };

    if (!this.isApiConfigured()) {
      // In manual/direct mode or when keys not set
      return { status: order.status, order };
    }

    try {
      const timestamp = Date.now().toString();
      const nonce = generateNonce(32);
      const bodyObj = { merchantTradeNo };
      const bodyStr = JSON.stringify(bodyObj);
      const signature = buildBinanceSignature(timestamp, nonce, bodyStr, config.binancePaySecretKey);

      const response = await axios.post(
        'https://bpay.binanceapi.com/binancepay/openapi/v2/order/query',
        bodyObj,
        {
          headers: {
            'Content-Type': 'application/json',
            'BinancePay-Timestamp': timestamp,
            'BinancePay-Nonce': nonce,
            'BinancePay-Certificate-SN': config.binancePayApiKey,
            'BinancePay-Signature': signature,
          },
          timeout: 15000,
        }
      );

      if (response.data?.status === 'SUCCESS' && response.data?.data) {
        const binanceStatus = response.data.data.status; // 'PAID', 'INITIAL', 'CLOSED', 'EXPIRED'
        order.status = binanceStatus;
        order.updatedAt = new Date().toISOString();
        saveOrders();
        return { status: binanceStatus, order };
      }
    } catch (err) {
      console.error('❌ Binance Pay Query API error:', err.response?.data || err.message);
    }

    return { status: order.status, order };
  }

  /**
   * Manually or Admin mark order as paid
   */
  static markOrderPaid(merchantTradeNo) {
    if (orders[merchantTradeNo]) {
      orders[merchantTradeNo].status = 'PAID';
      orders[merchantTradeNo].paidAt = new Date().toISOString();
      saveOrders();
      return orders[merchantTradeNo];
    }
    return null;
  }

  static getOrder(merchantTradeNo) {
    return orders[merchantTradeNo] || null;
  }

  static getLatestOrderForUser(userId) {
    const id = userId.toString();
    const userOrders = Object.values(orders).filter((o) => o.userId === id);
    if (userOrders.length === 0) return null;
    return userOrders[userOrders.length - 1];
  }
}

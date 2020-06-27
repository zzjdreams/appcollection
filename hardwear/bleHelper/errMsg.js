import BleHelper from './BleHelper.js'

// var ble=new BleHelper();

function catchErr(errMsg) {
  switch (errMsg) {
    case 0:
      //正常
      break;
    case 10000:
      //未初始化蓝牙适配器
      console.error('未初始化蓝牙适配器')
      break;
    case 10001:
      //当前蓝牙适配器不可用
      wx.showModal({
        title: '蓝牙状态提醒',
        content: '当前蓝牙适配器不可用,请检查蓝牙是否开启',
      })
      BleHelper.available_=false;
      // BleHelper.onBluetoothAdapterStateChange();
      break;
    case 10002:
      //没有找到指定设备
      break;
    case 10003:
      //连接失败
      wx.showToast({
        title: '连接失败',
      })
      break;
    case 10004:
      //没有找到指定服务
      break;
    case 10005:
      //没有找到指定特征值
      break;
    case 10006:
      //当前连接已断开
      wx.showToast({
        title: '当前连接已断开',
      })
      BleHelper.isConnected=false;
      break;
      case 10007:
      //当前特征值不支持此操作
      break;
    case 10008:
      //其余所有系统上报的异常
      break;
    case 10009:
      //Android 系统特有，系统版本低于 4.3 不支持 BLE
      break;
    case 10012:
      //连接超时
      wx.showToast({
        title: '连接超时',
      })
      break;
    case 10013:
      //连接 deviceId 为空或者是格式不正确
      console.error('连接 deviceId 为空或者是格式不正确')
      break;
    default:
      break;
  }
}

module.exports={
  catchErr:catchErr
}
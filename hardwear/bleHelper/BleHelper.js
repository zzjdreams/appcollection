const err = require('./errMsg.js')
const app=getApp();
const logUtil=require('../../utils/logUtil.js')
const strUtil = require('../../utils/strUtil.js');

var discoverTimer;
var clearDataTimer;

/**
 *  central	主机模式	
    peripheral	丛机模式
 */
const bleMode='peripheral';

// var parse = new ParseData();

var BleHelper = function BleHelper(opt_options){
  var options = opt_options || {};
  this.services_ = new Array();
  this.devices_=new Array();
  this.deviceId_='';
  this.serviceId_='';
  this.characteristicId_='';
  this.available_=false;
  this.discovering_=false;
  this.isConnected=false;
  this.canWrite=false;
  
  this.dataContainer=[];
  this.mtu_=20;
  this.deviceData={devices:[]}
  this.bleNotifyListener={
    type:'string',
    data:null
  }
}

BleHelper.prototype.setAvailable=function(avail){
  this.available_=avail;
}

// BleHelper.prototype.onBluetoothAdapterStateChange();

/**
 * 初始化蓝牙模块。iOS 上开启主机/丛机模式时需分别调用一次，指定对应的 mode
 */
BleHelper.prototype.openBluetoothAdapter = function (obj) {
  wx.openBluetoothAdapter({
    //蓝牙模式，可作为主/从设备，仅 iOS 需要。
    mode:bleMode,
    success: function (res) {
      console.info('success', res);
      if(!obj.success==false){
        obj.success();
      }
    },
    fail: function (res) {
      console.info('fail', res)
      err.catchErr(res.errCode);
      if(!obj.fail==false){
        obj.fail();
      }
    }
  })
}

/**
 * 监听蓝牙适配器状态变化事件
 */
BleHelper.prototype.onBluetoothAdapterStateChange = function () {
  const that =this;
  wx.onBluetoothAdapterStateChange((res) => {
    console.info("蓝牙适配器状态发生改变")
    //res.available:蓝牙适配器是否可用
    this.available_=res.available;
    console.log('监听available',res.available)
    //res.discovering:蓝牙适配器是否处于搜索状态
    this.discovering_=res.discovering;
    console.log('监听discovering',res.discovering)
    // if(res.available && !that.isConnected){
      // this.startBluetoothDevicesDiscovery();
    // }
  })
}

/**
 * 开始搜寻附近的蓝牙外围设备。此操作比较耗费系统资源，请在搜索并连接到设备后调用 wx.stopBluetoothDevicesDiscovery 方法停止搜索。
 */
BleHelper.prototype.startBluetoothDevicesDiscovery = function () {
  const that =this;
  if(this.discovering_){
    return;
  }
  logUtil.showLoading('搜索设备中...');
  //设置1分钟后自动关闭搜索功能
  if(discoverTimer!=null){
    clearTimeout(discoverTimer);
  }
  discoverTimer=setTimeout(()=>{
    that.stopBluetoothDevicesDiscovery()
  },120000)

  this.discovering_=true;
  wx.startBluetoothDevicesDiscovery({
    //要搜索的蓝牙设备主 service 的 uuid 列表。某些蓝牙设备会广播自己的主 service 的 uuid。
    //如果设置此参数，则只搜索广播包有对应 uuid 的主服务的蓝牙设备。建议主要通过该参数过滤掉周边不需要处理的其他蓝牙设备。
    //services:

    //是否允许重复上报同一设备。如果允许重复上报，则 wx.onBlueToothDeviceFound 方法会多次上报同一设备，但是 RSSI 值会有不同。
    allowDuplicatesKey:true,

    //上报设备的间隔。0 表示找到新设备立即上报，其他数值根据传入的间隔上报。
    // interval:
    success: function (res) {
      console.info('success', res);
      that.onBluetoothDeviceFound();
    },
    fail: function (res) {
      console.info('fail', res);
      err.catchErr(res.errCode);
      logUtil.hideLoading();
    }
  })
}


/**
 * 监听寻找到新设备的事件
 */
BleHelper.prototype.onBluetoothDeviceFound = function () {
  const that=this;
  // console.log('that.devices_', that)
  logUtil.hideLoading();
  wx.onBluetoothDeviceFound((res) => {
    //新搜索到的设备列表
   
    /**
     * 相关参数
     * name:蓝牙设备名称，某些设备可能没有
     * deviceId:用于区分设备的 id
     * RSSI:当前蓝牙设备的信号强度
     * advertisData:当前蓝牙设备的广播数据段中的 ManufacturerData 数据段。
     * advertisServiceUUIDs:当前蓝牙设备的广播数据段中的 ServiceUUIDs 数据段
     * localName:当前蓝牙设备的广播数据段中的 LocalName 数据段
     * serviceData:当前蓝牙设备的广播数据段中的 ServiceData 数据段
     */

    // console.info(res.devices);
    //遍历对象
    res.devices.forEach(device => {
      if (!device.name && !device.localName) {
        return
      }
      const foundDevices = that.devices_;
      console.log('fond',foundDevices)
      const idx = inArray(foundDevices, 'deviceId', device.deviceId)
      if (idx === -1) {
        that.devices_[foundDevices.length] = device
      } else {
        that.devices_[idx] = device //获取设备id
      }
    })
    this.deviceData.devices=that.devices_;
    // app.bleListener.devices=that.devices_;
    // that.devices_.push(res.devices)
  })
}

/**
 * 连接低功耗蓝牙设备。
  若小程序在之前已有搜索过某个蓝牙设备，并成功建立连接，可直接传入之前搜索获取的 deviceId 直接尝试连接该设备，无需进行搜索操作。
 */
BleHelper.prototype.createBLEConnection = function (deviceId,fn) {
  const that=this;
  if (that.devices_.length=0){
    // that.deviceId_ = that.devices_.deviceId;
    return;
  }
  logUtil.showLoading('连接中...');
  that.deviceId_=deviceId;
  // console.log('deviceId_', that.deviceId_)
  wx.createBLEConnection({
    deviceId: that.deviceId_,
    timeout: 10000,
    success: function (res) {
      console.info('success', res)
      that.getBLEDeviceServices();
      // that.services_.push(that.devices_[index])
      if(typeof(fn.success)=='function' ){
        fn.success();
      }
    },
    fail: function (res) {
      console.info('fail', res)
      err.catchErr(res.errCode);    
      if(typeof(fn.fail)=='function' ){
        fn.fail();
      }
    }
  })
  if (that.discovering_) {
    that.stopBluetoothDevicesDiscovery();
  }
  
  that.getBluetoothDevices();
}

/**
 * 获取蓝牙设备所有服务(service)
 */
BleHelper.prototype.getBLEDeviceServices = function () {
  const that=this;
  wx.getBLEDeviceServices({
    deviceId: that.deviceId_,
    success: function (res) {
      console.info('success', res)
      for(var i=0;i<res.services.length;i++){
        console.log('uuid',res.services[i].uuid);
        if (res.services[i].isPrimary){
          that.getBLEDeviceCharacteristics(that.deviceId_, res.services[i].uuid);
          return;
        }
      }
    },
    fail: function (res) {
      console.info('fail', res)
    }
  })
}

/**
 * 获取蓝牙设备某个服务中所有特征值(characteristic)
 */
BleHelper.prototype.getBLEDeviceCharacteristics = function (deviceId, serviceId) {
  const that=this;
  wx.getBLEDeviceCharacteristics({
    deviceId: deviceId,
    serviceId: serviceId,
    success: function (res) {
      console.info('success', res)
      res.characteristics.forEach(item=>{
        if (item.properties.read){
          that.readBLECharacteristicValue(deviceId,serviceId,item.uuid);
        }
        if(item.properties.write){
          that.canWrite=true;
          that.deviceId_ = deviceId
          that.serviceId_ = serviceId
          that.characteristicId_ = item.uuid
        }
        //监听蓝牙发送过来的值了
        if (item.properties.notify || item.properties.indicate) {
          that.notifyBLECharacteristicValueChange(deviceId,serviceId,item.uuid)
        }
      })
      // for(let i=0;i<res.characteristics.length;i++){
      //   let item
      //   if(res.characteristics[i].)
      // }
    },
    fail: function (res) {
      console.info('fail', res)
    }
  })
  
 
}

/**
 * 根据 uuid 获取处于已连接状态的设备。
 * 已经连接过的设备
 */
BleHelper.prototype.getConnectedBluetoothDevices = function () {
  wx.getConnectedBluetoothDevices({
    services: this.services_,
    success: function (res) {
      console.info('success', res)
    },
    fail: function (res) {
      console.info('fail', res)
    }
  })
}

/**
 * 停止搜寻附近的蓝牙外围设备。若已经找到需要的蓝牙设备并不需要继续搜索时，建议调用该接口停止蓝牙搜索
 */
BleHelper.prototype.stopBluetoothDevicesDiscovery=function(){
  wx.stopBluetoothDevicesDiscovery({
    success:function(res){
      console.info('success',res)
    },
    fail:function(res){
      console.info('fail',res)
    }
  })
}




/**
 * 取消监听寻找到新设备的事件。
 */
BleHelper.prototype.offBluetoothDeviceFound = function () {
  wx.offBluetoothDeviceFound(this.onBluetoothDeviceFound)
}

/**
 * 取消监听蓝牙适配器状态变化事件。
 */
BleHelper.prototype.offBluetoothAdapterStateChange = function () {
  wx.offBluetoothAdapterStateChange(this.onBluetoothAdapterStateChange)
}



/**
 * 获取在蓝牙模块生效期间所有已发现的蓝牙设备。包括已经和本机处于连接状态的设备。
 */
BleHelper.prototype.getBluetoothDevices = function () {
  wx.getBluetoothDevices({
    success: function (res) {
      console.info('success', res)
    },
    fail: function (res) {
      console.info('fail', res)
    }
  })
}

/**
 * 获取本机蓝牙适配器状态
 */
BleHelper.prototype.getBluetoothAdapterState = function () {
  wx.getBluetoothAdapterState({
    success: function (res) {
      console.info('success', res)
    },
    fail: function (res) {
      console.info('fail', res)
    }
  })
}

/**
 * 关闭蓝牙模块。调用该方法将断开所有已建立的连接并释放系统资源。建议在使用蓝牙流程后，与 wx.openBluetoothAdapter 成对调用。
 */
BleHelper.prototype.closeBluetoothAdapter = function () {
  wx.closeBluetoothAdapter({
    success: function (res) {
      console.info('success', res)
    },
    fail: function (res) {
      console.info('fail', res)
    }
  })
}

/**
 * 向低功耗蓝牙设备特征值中写入二进制数据。注意：必须设备的特征值支持 write 才可以成功调用。
 */
BleHelper.prototype.writeBLECharacteristicValue=function(arrayBuffer,oldData){
  const that=this;
  const delay=that.mtu_/100;
    if(oldData!=true){
      if(!arrayBuffer==false){
        that.dataContainer.push(arrayBuffer);
        if(that.dataContainer.length>1){
          return;
        }
      }
    }
  let buffer =that.dataContainer[0];
  let pos = 0;
  let bytes = buffer.byteLength;
 
  if (bytes > 0) {
    let tmpBuffer;
    let tmpBuffer2;
    if (bytes > that.mtu_) {
      return delayFn(delay).then(() => {
        //将arraybuffer进行分段处理
        tmpBuffer = buffer.slice(pos, pos + that.mtu_);
        pos += that.mtu_;
        bytes -= that.mtu_;
        logUtil.log("tmpBuffer", strUtil.arrayBuffer2String(tmpBuffer) );
        // console.log('dev_id=='+that.deviceId_+"=ser_id="+that.serviceId_+"=char_id="+that.characteristicId_)
        wx.writeBLECharacteristicValue({
          deviceId: that.deviceId_,
          serviceId: that.serviceId_,
          characteristicId: that.characteristicId_,
          value: tmpBuffer,
          success(res) {
            logUtil.log('第一次发送', res)
            logUtil.log('发送', tmpBuffer)
          },
          fail: function (res) {
            that.dataContainer=[];
            logUtil.log('发送失败', res)
            err.catchErr(res.errCode);
          }
        })
        // logUtil.log('buffer1', tmpBuffer)
        tmpBuffer2 = buffer.slice(pos, pos + bytes);
        that.dataContainer[0]=tmpBuffer2;
        return this.writeBLECharacteristicValue(tmpBuffer2,true)
      })

    } else {
      return delayFn(delay).then(() => {
        tmpBuffer = buffer.slice(pos, pos + bytes);
        logUtil.log('buffer2', strUtil.arrayBuffer2String(tmpBuffer) )
        pos += bytes;
        bytes -= bytes;
        wx.writeBLECharacteristicValue({
          deviceId: that.deviceId_,
          serviceId: that.serviceId_,
          characteristicId: that.characteristicId_,
          value: tmpBuffer,
          success(res) {
            logUtil.log('第二次发送', res)
            logUtil.log('发送', tmpBuffer)
            that.dataContainer.shift();
            if(that.dataContainer.length>0){
              return that.writeBLECharacteristicValue();
            }
            if(clearDataTimer!=null){
              clearTimeout(clearDataTimer);
            }
            clearDataTimer=setTimeout(()=>{
              that.dataContainer=[];
            },10000)
          },
          fail: function (res) {
            that.dataContainer=[];
            err.catchErr(res.errCode);
          }
        })
      })
    }
  }



  // wx.writeBLECharacteristicValue({
  //   deviceId:this.deviceId_,
  //   serviceId: this.serviceId_,
  //   characteristicId: this.characteristicId_,
  //   value: arrayBuffer,
  //   success: function (res) {
  //     console.info('success', res)
  //   },
  //   fail: function (res) {
  //     console.info('fail', res)
  //   }
  // })
}

/**
 * 设置蓝牙最大传输单元。需在 wx.createBLEConnection调用成功后调用，mtu 设置范围 (22,512)。安卓5.1以上有效
 */
BleHelper.prototype.setBLEMTU = function (mtu) {
  this.mtu_=mtu;
  if(typeof(wx.setBLEMTU=='function') && (!wx.setBLEMTU==false)){
    wx.setBLEMTU({
      deviceId:this.deviceId_,
      //最大传输单元(22,512) 区间内，单位 bytes
      mtu:mtu,
      success: function (res) {
        console.info('success', res)
      },
      fail: function (res) {
        console.info('fail', res)
      }
    })
  }
}

/**
 * 读取低功耗蓝牙设备的特征值的二进制数据值。注意：必须设备的特征值支持 read 才可以成功调用。
 */
BleHelper.prototype.readBLECharacteristicValue = function (deviceId, serviceId, characteristicId) {
  wx.readBLECharacteristicValue({
    deviceId: deviceId,
    serviceId: serviceId,
    characteristicId: characteristicId,
    success: function (res) {
      console.info('success', res)
    },
    fail: function (res) {
      console.info('fail', res)
    }
  })
}

/**
 * 监听低功耗蓝牙连接状态的改变事件。包括开发者主动连接或断开连接，设备丢失，连接异常断开等等
 */
BleHelper.prototype.onBLEConnectionStateChange = function (obj) {
  wx.onBLEConnectionStateChange((res)=>{
    console.info(res);
    obj(res);
  })
}

/**
 * 监听低功耗蓝牙设备的特征值变化事件。必须先启用 notifyBLECharacteristicValueChange 接口才能接收到设备推送的 notification。
 */
BleHelper.prototype.onBLECharacteristicValueChange = function () {

  wx.onBLECharacteristicValueChange((res)=>{
    // this.bleListeners.prototype.notifyListener(res);
    if(this.bleNotifyListener.type=='hex'){
      this.bleNotifyListener.data=strUtil.arrayBuffer2HexString(res.value);
    }else{
      this.bleNotifyListener.data=strUtil.arrayBuffer2String(res.value);
    }
    
    // console.log( '接收', )
    // app.bleListener.receiveData+=strUtil.arrayBuffer2String(res.value);
    // parse.parseArray(res.value);   
    // console.log(`characteristic ${res.characteristicId} has changed, now is ${res.value}`)

  })
}

/**
 * 取消监听低功耗蓝牙连接状态的改变事件
 */
BleHelper.prototype.offBLEConnectionStateChange = function () {
  wx.offBLEConnectionStateChange(this.onBLEConnectionStateChange())
}

/**
 * 取消监听低功耗蓝牙设备的特征值变化事件。
 */
BleHelper.prototype.offBLECharacteristicValueChange = function () {
  wx.offBLECharacteristicValueChange(this.onBLECharacteristicValueChange())
}

/**
 * 启用低功耗蓝牙设备特征值变化时的 notify 功能，订阅特征值。注意：必须设备的特征值支持 notify 或者 indicate 才可以成功调用。
   另外，必须先启用 notifyBLECharacteristicValueChange 才能监听到设备 characteristicValueChange 事件
 */
BleHelper.prototype.notifyBLECharacteristicValueChange = function (deviceId,serviceId,characteristicId) {
  const that=this;
  console.info('======启动接收=====');
  wx.notifyBLECharacteristicValueChange({
    deviceId: deviceId,
    serviceId: serviceId,
    characteristicId: characteristicId,
    state: true,
    success: function(res) {
      console.info('启动接收',res);
      that.onBLECharacteristicValueChange();
    },
  })
  
}



/**
 * 获取蓝牙设备的信号强度
 */
BleHelper.prototype.getBLEDeviceRSSI = function () {
  wx.getBLEDeviceRSSI({
    deviceId: this.deviceId_,
    success: function (res) {
      console.info('success', res)
    },
    fail: function (res) {
      console.info('fail', res)
    }
  })
}





/**
 * 断开与低功耗蓝牙设备的连接
 */
BleHelper.prototype.closeBLEConnection = function () {
  wx.closeBLEConnection({
    deviceId: this.deviceId_,
    success: function (res) {
      console.info('success', res)
      wx.showToast({
        title: '蓝牙已断开',
        icon:'success'
      })
    },
    fail: function (res) {
      console.info('fail', res)
    }
  })
}

//设置延迟
function delayFn(ms, res) {
  return new Promise(function(resolve, reject) {
    setTimeout(function() {
      resolve(res);
      reject(res);
    }, ms);
  });
}

function inArray(arr, key, val) {
  // console.info(arr+"-"+key+"-"+val)
  for (let i = 0; i < arr.length; i++) {
    if (arr[i][key] === val) {
      return i;
    }
  }
  return -1;
}

export default BleHelper;
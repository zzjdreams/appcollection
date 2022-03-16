// hardwear/pages/bleOperate/bleOperate.js

import BleHelper from '../../bleHelper/BleHelper'
const myWatch = require("../../../utils/watch.js");
const logUtil = require("../../../utils/logUtil.js");
const strUtil = require("../../../utils/strUtil.js");
const bleHelper = new BleHelper();
const app = getApp();

var delayTimer=null;
Page({

  /**
   * 页面的初始数据
   */
  data: {
    bleName: '未连接',
    isChecked: false,
    isConnected: false,
    bleList: [],
    display: 'none',
    menuDisplay:'none',
    textDisplay:'block',
    delayTime: 1000,
    delayDisabled: true,
    mtuDisabled:true,
    sendDisabled:false,
    inputClassDelay:"checkBoxInputUnchecked",
    inputClassMtu:"checkBoxInputUnchecked",
    

    //ble params
    devices: [],
    receiveMsg: '',
    commdata: '',
    delayMsg:'',
    mtuMsg:'',
    delayInfo:null,
    mtuInfo:null,

  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    myWatch.watch(bleHelper.deviceData, "devices", this.bleList);
    myWatch.watch(bleHelper.bleNotifyListener, "devices", this.bleNotifyListener);
  },

  switch (e) {
    const that = this;
    // console.log(e.detail.value)
    if (e.detail.value == true) {
      // 点击打开ble时打开蓝牙适配器

      // console.log(1, that.data.isChecked)
      bleHelper.openBluetoothAdapter({
        success: function () {
          // that.data.isConnected=true;
          that.data.isChecked=true;
        },
        fail: function () {
          wx.showModal({
            title: '无法打开蓝牙',
            cancelColor: 'cancelColor',
          })
          // that.data.isConnected=false;
          that.data.isChecked=false;
        }
      });
      // console.log(2, that.data.isChecked)
      bleHelper.onBluetoothAdapterStateChange();
      // 监听蓝牙状态
      bleHelper.onBLEConnectionStateChange((res) => {
        if (res.connected) {
          logUtil.showToast('蓝牙已连接');
          that.setData({
            isConnected : true
          })
          
        } else {
          logUtil.showToast('蓝牙已断开');
          clearInterval(delayTimer);
          that.setData({
            isConnected : false,
            bleName:'未连接'
          })
        }
      });
    } 
    else {  
      // console.log(3, that.data.isChecked);
      that.data.isChecked=false;
      // 关闭监听事件
      bleHelper.offBLECharacteristicValueChange();
      bleHelper.offBLEConnectionStateChange();
      bleHelper.offBluetoothAdapterStateChange();
      if(that.data.isConnected){
        bleHelper.closeBLEConnection();
      }
      bleHelper.closeBluetoothAdapter();

      that.data.devices = [];
      that.data.receiveMsg = '';
      that.setData(that.data)
    }
    wx.showToast({
      title: '正在配置中',
      mask:true,
      duration:1000,
      icon:"loading"
    })
    setTimeout(()=>{
      that.setData(that.data)
    },500)
    console.log(4, that.data.isChecked)
  },

  dismissList: function () {
    const that = this;
    console.log('bind');
    that.setData({
      display: 'none'
    })
  },
  
  //搜索按钮点击
  bleSearch: function () {
    const that = this;
    if (this.data.isChecked) {
      if (that.data.isConnected) {
        bleHelper.closeBLEConnection();
      }
      that.data.devices = [];
      that.data.display = 'flex'
      bleHelper.startBluetoothDevicesDiscovery();
    } else {
      wx.showModal({
        title: '先开启右上角滑块',
        cancelColor: 'cancelColor',
      })
    }
    that.setData(that.data);
  },
  bleList: function (devices_) {
    this.setData({
      devices: devices_
    })
  },
  bleNotifyListener:function(data){
    const that =this;
    that.data.receiveMsg += data;
    
    if (that.data.receiveMsg.length > 3000) {
      that.data.receiveMsg.slice(1000, 3000);
    }
    that.setData({
      receiveMsg: msg
    })
  },
  //选择设备连接
  createBLEConnection: function (e) {
    const that = this;
    const ds = e.currentTarget.dataset
    var msg = '';
    console.log(e)
    bleHelper.createBLEConnection(ds.deviceId, {
      success: function () {
        logUtil.hideLoading();
        that.setData({
          bleName:ds.name,
          isConnected:true
        });
        // wx.showToast({
        //   title: '蓝牙已连接',
        //   icon: 'success'
        // })
      },
      fail: function () {
        logUtil.hideLoading();
        logUtil.showToast("连接==" + ds.name + "==失败")
      }
    }); 
   
  },
  keylistener: function (e) {
    this.setData({
      commdata: e.detail.value
    })
  },
  sendMsg: function () {
    const that = this;
    var sendValue = that.data.commdata;
    if (!sendValue == false) {
      bleHelper.writeBLECharacteristicValue(strUtil.stringToBytes(sendValue))
    }
  },
  clearMsg: function () {
    this.setData({
      receiveMsg: ''
    })
  },
  settingBle:function(){
    this.setData({
      menuDisplay:'flex',
      textDisplay:'none'
    })
  },
  menuComfirm:function(){
    const that =this;
    // console.log('menuComfirm')
    if(!that.data.delayDisabled){
      that.data.delayInfo=parseInt(that.data.delayMsg);
      console.log('that.data.delayInfo',that.data.delayInfo)
      if(!that.data.delayInfo==false && !that.data.commdata==false){
        if(!delayTimer==false){
          clearInterval(delayTimer);
        }
        delayTimer=setInterval(()=>{
          bleHelper.writeBLECharacteristicValue(strUtil.stringToBytes(that.data.commdata))
        },that.data.delayInfo)
        that.data.sendDisabled=true;
      }
    }else{
      that.data.delayInfo=null;
      that.data.sendDisabled=false;
      if(!delayTimer==false){
        clearInterval(delayTimer);
      }
    }
    if(!that.data.mtuDisabled){
      that.data.mtuInfo=parseInt(that.data.mtuMsg);
      console.log('that.data.mtuInfo',that.data.mtuInfo)
      if(!that.data.mtuMsg==false){
        if(that.data.mtuInfo>=20 && that.data.mtuInfo<=512){
          bleHelper.setBLEMTU(that.data.mtuInfo)
        }
      }
    }else{
      that.data.mtuInfo=null;
    }
    that.data.menuDisplay='none';
    that.data.textDisplay='block';
    that.setData(that.data);
  },
  menuCancel:function(){
    // console.log('menuCancel')
    this.setData({
      menuDisplay:'none',
      textDisplay:'block'
    })
  },
  radioChange:function(e){
    bleHelper.bleNotifyListener.type=e.detail.value;
  },
  checkBoxChange:function(e){
    console.log(e);
    if(e.detail.value.includes("sendDelay")){
      this.data.delayDisabled=false;
      this.data.inputClassDelay="checkBoxInputChecked";
    }else{
      this.data.delayDisabled=true;
      this.data.inputClassDelay="checkBoxInputUnchecked";
    }
    if(e.detail.value.includes("mtuSpeed")){
      this.data.mtuDisabled=false;
      this.data.inputClassMtu="checkBoxInputChecked";
    }else{
      this.data.mtuDisabled=true;
      this.data.inputClassMtu="checkBoxInputUnchecked";
    }
    this.setData(this.data)
  },
  delaylistener:function(e){
    this.data.delayMsg=e.detail.value;
  },
  mtulistener:function(e){
    this.data.mtuMsg=e.detail.value;
  }
})
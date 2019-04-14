import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

import webApi from "./api";

import {
  Auth,
  TrucksIntent,
  FreightagesIntent,
  BargainsIntent,
  UsersIntent,
  TransactionsIntent,
  PickupsIntent,
  Finances,
  Notifications,
  CronJob,
  Messaging
} from "./intent";

//inititalize firebase admin
admin.initializeApp(functions.config().firebase);

export const onSignUpComplete = Auth.onSignUpComplete;
export const onAssociateMomoNumberIntent = Auth.addWithdrawalPhonenumber;
export const onChangePrincipalPhonenumber = Auth.changePrincipalPhonenumber;
export const onDeleteWithdrawalPhonenumber = Auth.deleteWithdrawalPhonenumber;
export const onDeleteMomoProviderIntent = Auth.onDeleteAccount;
export const onUpdateProfileImage = Auth.updateProfileImage;
export const onUpdateTransactionCode = Auth.onUpdateTransactionCode;

//trucks management
export const listenAddTruckIntent = TrucksIntent.listenAddTruckIntent;
export const listenDeleteTruckIntent = TrucksIntent.listenDeleteTruckIntent;
export const listenAddTechnicalVisitIntent =
  TrucksIntent.listenAddTechnicalVisitIntent;
export const listenAddInsurranceIntent = TrucksIntent.listenAddInsurranceIntent;
export const listenLinkNewDriverTruckIntent =
  TrucksIntent.listenLinkNewDriverTruckIntent;
export const listenUnLinkDriverTruckIntent =
  TrucksIntent.listenUnLinkDriverTruckIntent;
export const listenNotifyDriverOfDissociation =
  TrucksIntent.listenNotifyDriverOfDissociation;
export const listenCancelNotifyDriverOfDissociation =
  TrucksIntent.listenCancelNotifyDriverOfDissociation;
export const listenAddRegistrationCertificateIntent =
  TrucksIntent.listenAddRegistrationCertificateIntent;

//freightage management
export const listenAddFreightageIntent =
  FreightagesIntent.listenAddFreightageIntent;
export const listenDeleteFreightage = FreightagesIntent.listenDeleteFreightage;
export const listenMarkAsDeliveredNew = FreightagesIntent.listenMarkAsDelivered;
export const listenMarkAsCompletedNew = FreightagesIntent.listenMarkAsCompleted;

//bargain
export const listenAddBargainerOnRTDB = BargainsIntent.listenAddBargainerOnRTDB;
export const listenHireDriversOnRTDB = BargainsIntent.listenHireDriversOnRTDB;
export const listenPostResponseForHireDriver =
  BargainsIntent.listenAcceptHireRequest;

//Pickups
export const listenMarkAsPickupNew = PickupsIntent.listenMarkAsPickup;
export const listenValidatePickup = PickupsIntent.listenValidatePickup;

//users
export const listenAddReview = UsersIntent.listenAddReview;

//cron
export const cronJob = CronJob.cronJob;

//messaging
export const listenNewMessage = Messaging.listenNewMessage;

//payment
export const listenMakePayment = TransactionsIntent.listenMakePayment;
export const listenMakeWithdrawal = TransactionsIntent.listenMakeWithdrawal;
//init API
export const api = webApi;

//Wecashup intergration.
export const onPayment = Finances.onPayment;
export const onWithdraw = Finances.onWithdraw;
export const onWithdrawWebhook = Finances.onWithdrawWebhook;
export const onPaymentWebhook = Finances.onPaymentWebhook;
// export const onTransactionCode = Finances.onTransactionCode;
export const payMoneyInEscrow = Finances.payMoneyInEscrow;

//Notifications
export const onDepositNotification = Notifications.onDeposit;
export const onNotification = Notifications.onNotification;

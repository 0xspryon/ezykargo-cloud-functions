import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

import webApi from "./api";

import {Auth, TrucksIntent,FreightagesIntent,BargainsIntent,UsersIntent,TransactionsIntent,PickupsIntent} from "./intent";

//inititalize firebase admin
admin.initializeApp(functions.config().firebase);

export const onSignUpComplete = Auth.onSignUpComplete
export const onAssociateMomoNumberIntent = Auth.addWithdrawalPhonenumber
export const onChangePrincipalPhonenumber = Auth.changePrincipalPhonenumber
export const onDeleteWithdrawalPhonenumber = Auth.deleteWithdrawalPhonenumber
export const onDeleteMomoProviderIntent = Auth.onDeleteAccount
export const onUpdateProfileImage = Auth.updateProfileImage

//trucks management
export const listenAddTruckIntent = TrucksIntent.listenAddTruckIntent
export const listenDeleteTruckIntent = TrucksIntent.listenDeleteTruckIntent
export const listenAddTechnicalVisitIntent = TrucksIntent.listenAddTechnicalVisitIntent
export const listenAddInsurranceIntent = TrucksIntent.listenAddInsurranceIntent
export const listenLinkNewDriverTruckIntent = TrucksIntent.listenLinkNewDriverTruckIntent
export const listenUnLinkDriverTruckIntent = TrucksIntent.listenUnLinkDriverTruckIntent

//freightage management
export const listenAddFreightageIntent = FreightagesIntent.listenAddFreightageIntent
//export const listenMarkAsPickup = FreightagesIntent.listenMarkAsPickup
export const listenMarkAsDelivered = FreightagesIntent.listenMarkAsDelivered
export const listenMarkAsCompleted = FreightagesIntent.listenMarkAsCompleted

//bargain
export const listenAddBargainerOnRTDB = BargainsIntent.listenAddBargainerOnRTDB
export const listenHireDriversOnRTDB = BargainsIntent.listenHireDriversOnRTDB
export const listenPostResponseForHireDriver = BargainsIntent.listenPostResponseForHireDriver

//Pickups
export const listenMarkAsPickup = PickupsIntent.listenMarkAsPickup
export const listenValidatePickup = PickupsIntent.listenValidatePickup

//users
export const listenAddReview = UsersIntent.listenAddReview

//payment
export const listenMakePayment = TransactionsIntent.listenMakePayment

//init API
export const api = webApi;
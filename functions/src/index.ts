import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {Auth, TrucksIntent} from "./intent";

//inititalize firebase admin
admin.initializeApp(functions.config().firebase);

export const onSignUpComplete = Auth.onSignUpComplete
export const listenAddTruckIntent = TrucksIntent.listenAddTruckIntent
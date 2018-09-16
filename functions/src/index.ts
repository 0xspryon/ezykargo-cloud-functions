import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {Auth, TrucksIntent} from "./intent";

//inititalize firebase admin
admin.initializeApp(functions.config().firebase);

export const onSignUpComplete = Auth.onSignUpComplete
export const onAssociateMomoNumberIntent = Auth.onAssociateMomoNumberIntent
export const onDeleteMomoProviderIntent = Auth.onDeleteMomoProviderIntent

//trucks management
export const listenAddTruckIntent = TrucksIntent.listenAddTruckIntent
export const listenAddTechnicalVisitIntent = TrucksIntent.listenAddTechnicalVisitIntent
export const listenAddInsurranceIntent = TrucksIntent.listenAddInsurranceIntent
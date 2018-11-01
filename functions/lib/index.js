"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const intent_1 = require("./intent");
//inititalize firebase admin
admin.initializeApp(functions.config().firebase);
exports.onSignUpComplete = intent_1.Auth.onSignUpComplete;
exports.onAssociateMomoNumberIntent = intent_1.Auth.onAssociateMomoNumberIntent;
exports.onDeleteMomoProviderIntent = intent_1.Auth.onDeleteMomoProviderIntent;
//trucks management
exports.listenAddTruckIntent = intent_1.TrucksIntent.listenAddTruckIntent;
exports.listenDeleteTruckIntent = intent_1.TrucksIntent.listenDeleteTruckIntent;
exports.listenAddTechnicalVisitIntent = intent_1.TrucksIntent.listenAddTechnicalVisitIntent;
exports.listenAddInsurranceIntent = intent_1.TrucksIntent.listenAddInsurranceIntent;
exports.listenLinkNewDriverTruckIntent = intent_1.TrucksIntent.listenLinkNewDriverTruckIntent;
exports.listenUnLinkDriverTruckIntent = intent_1.TrucksIntent.listenUnLinkDriverTruckIntent;
//freightage management
exports.listenAddFreightageIntent = intent_1.FreightagesIntent.listenAddFreightageIntent;
//bargain
exports.listenAddBargainerOnRTDB = intent_1.BargainsIntent.listenAddBargainerOnRTDB;
//# sourceMappingURL=index.js.map
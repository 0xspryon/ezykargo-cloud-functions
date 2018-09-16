"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const intent_1 = require("./intent");
//inititalize firebase admin
admin.initializeApp(functions.config().firebase);
exports.onSignUpComplete = intent_1.Auth.onSignUpComplete;
exports.onAssociateMomoNumberIntent = intent_1.Auth.onAssociateMomoNumberIntent;
//trucks management
exports.listenAddTruckIntent = intent_1.TrucksIntent.listenAddTruckIntent;
exports.listenAddTechnicalVisitIntent = intent_1.TrucksIntent.listenAddTechnicalVisitIntent;
exports.listenAddInsurranceIntent = intent_1.TrucksIntent.listenAddInsurranceIntent;
//# sourceMappingURL=index.js.map
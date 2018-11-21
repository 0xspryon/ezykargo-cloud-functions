import * as admin from 'firebase-admin';

export class Transactions {
    
    static bucketPath: string = "/bucket/transactionsList/";
    static basePath: string = `${Transactions.bucketPath}transactions/`;
    static moneyAccount: string = `/bucket/moneyAccount`;
    static bucketPathMoney: string = Transactions.moneyAccount + "/moneyAccounts/";

    static getRef = (id) =>{
        return `${Transactions.basePath}${id}`
    }

    static getRefMoneyAccount = (id) =>{
        return `${Transactions.bucketPathMoney}${id}`
    }

    static getDocByRef = async (ref)=>{
        return admin.firestore().doc(ref).get()
    }
    static getDoc = async (id)=>{
        return admin.firestore().doc(Transactions.getRef(id)).get()
    }


}
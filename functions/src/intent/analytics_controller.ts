import { FreightagesIntent } from "./Freightages";

const functions = require('firebase-functions');

const request = require('request-promise');

let elasticSearchConfig = functions.config().elasticsearch;
let elasticSearchFreightUrl = (prefix: string, ref_id: string) => elasticSearchConfig.url + `freightage_${prefix}/_doc/${ref_id}`;
let elasticSearchFreightUpdateUrl = (prefix: string, ref_id: string) => elasticSearchConfig.url + `freightage_${prefix}/_update/${ref_id}`;
let elasticSearchMethod = {
    post: 'POST',
    delete: 'DELETE',
    put: 'PUT',
};

export class AnalyticscController {

    static saveFreightageDeclarationToAnalytics = (ref_id) => {
        const freightageDeclarationPrefix = 'created'
        let body = {
            eventAt: (new Date()).getTime() + 20,
            created: true,
            term:'created',
            ref_id,
        }

        let elasticsearchRequest = {
            method: elasticSearchMethod.put,
            uri: elasticSearchFreightUrl(freightageDeclarationPrefix, ref_id),
            body,
            json: true
        };

        return request(elasticsearchRequest).then(response => {
            console.log('Ealstsearch freightage declaration', response);
        })

    }

    static saveFreightagePickedUpToAnalytics = (freightage, ref_id) => {
        const freightagePickUpPrefix = 'picked_up'

        const {
            weight, volume, items,
            to, title, from,
            amount, bizAmount,
        } = freightage

        const body = {
            weight, volume,
            to, title, from,
            amount, bizAmount,
            items: items.map(item => ({
                name: item.name,
                quantity: item.quantity,
                unit_type: item.unit_type,
                weight: item.weight,
            })),
            term:'picked_up',
            pickup: true,
            eventAt: (new Date()).getTime() + 20,
            ref_id,
        }

        let elasticsearchRequest = {
            method: elasticSearchMethod.put,
            uri: elasticSearchFreightUrl(freightagePickUpPrefix, ref_id),
            body,
            json: true
        };

        return request(elasticsearchRequest).then(response => {
            // console.log('Elasticsearch Freightage pickup', response);
        })
    }

    static saveFreightageDeliveredToAnalytics = (ref_id: string) => {
        const freightagePickUpPrefix = 'delivered'

        let body = {
            delivered: true,
            term:'delivered',
            eventAt: (new Date()).getTime() + 20,
            ref_id,
        }

        let elasticsearchRequest = {
            method: elasticSearchMethod.put,
            uri: elasticSearchFreightUrl(freightagePickUpPrefix, ref_id),
            body,
            json: true
        };

        return request(elasticsearchRequest).then(response => {
            // console.log('Elasticsearch Freightage delivered', response);
        })

    }

    static saveFreightageIdlingToAnalytics = (ref_id) => {
        const freightagePickUpPrefix = 'idling'

        let body = {
            idle: true,
            term:'idle',
            eventAt: (new Date()).getTime() + 20,
            ref_id,
        }

        let elasticsearchRequest = {
            method: elasticSearchMethod.put,
            uri: elasticSearchFreightUrl(freightagePickUpPrefix, ref_id),
            body,
            json: true
        };

        return request(elasticsearchRequest).then(response => {
            // console.log('Elasticsearch Freightage idling', response);
        })

    }

    static saveFreightageDeleteToAnalytics = (ref_id) => {
        const freightagePickUpPrefix = 'delete'

        let body = {
            isDeleted: true,
            term:'deleted',
            eventAt: (new Date()).getTime() + 20,
            ref_id,
        }

        const elasticsearchRequest = {
            method: elasticSearchMethod.put,
            uri: elasticSearchFreightUrl(freightagePickUpPrefix, ref_id),
            body,
            json: true
        };

        return request(elasticsearchRequest).then(response => {
            // console.log('Elasticsearch freightage deleted', response);
        })

    }

    static saveFreightageCompletedToAnalytics = (freightage, ref_id) => {
        const freightagePickUpPrefix = 'completed'

        const {
            weight, volume, items,
            to, title, from,
            amount, bizAmount,
        } = freightage

        const body = {
            doc: {
                term:'completed',
                weight, volume,
                to, title, from,
                amount, bizAmount,
                completed: true,
                items: items.map(item => ({
                    name: item.name,
                    quantity: item.quantity,
                    unit_type: item.unit_type,
                    weight: item.weight,
                })),
                eventAt: (new Date()).getTime() + 20,
                ref_id,
            },
            doc_as_upsert: true,
        }

        const elasticsearchRequest = {
            method: elasticSearchMethod.put,
            uri: elasticSearchFreightUpdateUrl(freightagePickUpPrefix, ref_id),
            body,
            json: true
        };

        return request(elasticsearchRequest).then(response => {
            // console.log('Elasticsearch Freightage completed', response);
        })

    }

    static savePlatformIncomeToAnalytics = (ref_id, amount) => {
        const freightagePickUpPrefix = 'completed'

        const body = {
            doc: {
                platform_amount: amount,
                paid: true,
            },
            doc_as_upsert: true
        }

        const elasticsearchRequest = {
            method: elasticSearchMethod.put,
            uri: elasticSearchFreightUpdateUrl(freightagePickUpPrefix, ref_id),
            body,
            json: true
        };

        return request(elasticsearchRequest).then(response => {
            // console.log('Elasticsearch Freightage completed revenue', response);
        })

    }

}

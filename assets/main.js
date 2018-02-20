$(function () {
    var client = ZAFClient.init();
    JateknetApp.setClient(client);
    JateknetApp.client.metadata().then(function (metadata) {
        JateknetApp.settings = metadata.settings;
        JateknetApp.log(metadata.settings);

        // @see https://developer.zendesk.com/apps/docs/apps-v2/support_api#ticket-object
        client.get([
            "currentUser.customField:jn_admin_name", // https://developer.zendesk.com/apps/docs/apps-v2/api_reference#zaf-client-api
            "ticket.id",
            "ticket.comments",
            "ticket.subject",
            "ticket.requester.email",
            JateknetApp.settings.order_id_ticket_field_name // Order ID
        ]).then(function (response) {
            JateknetApp.init(response);
        });

    });

});
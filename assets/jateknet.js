var JateknetApp = {

    /**
     * @see manifest.json / parameters
     */
    settings: null,

    /**
     * ZAFClient.init() által létrehozott Zendesk app client objektum.
     */
    client: null,

    /**
     * Az aktuális ticket lekérdezett adatai.
     */
    ticketData: null,

    /**
     * A megjelenített megrendelés adatai.
     */
    order_data: null,

    /**
     * Admin név a Játéknet admin felületen.
     */
    jn_admin_name: null,

    /**
     * Megrendelés azonosító.
     */
    order_id: null,

    init: function (ticketData) {
        ticketData.order_id = ticketData[JateknetApp.settings.order_id_ticket_field_name];
        ticketData.jn_admin_name = ticketData["currentUser.customField:jn_admin_name"];
        JateknetApp.log("init param=", ticketData);

        // Nem töltötték még az admin név mezőt.
        if (!ticketData.jn_admin_name) {
            UI.displayErrorMessage('Nincs még beállítva az agenthez Játéknet admin-beli név. Kattints a Zendeskben a Settings / People menüben az agent melletti "Edit" gombra, majd töltsd ki a "Admin login name" mezőt a Játéknet admin felületen használt login nevével. Ezután töltsd újra ezt az oldalt.');
            return;
        }

        JateknetApp.setTicketData(ticketData);        
        JateknetApp.findOrderId();
        JateknetApp.setOrderId(this.order_id);
        //https://developer.zendesk.com/apps/docs/apps-v2/using_sdk#working-with-framework-events
        this.client.on("ticket.save", function () {
          	return JateknetApp.syncHistory();
        });
        UI.setupUI();
    },

    /**
     * Milyen e-mail címet adott meg a vásárló a rendelésnél?
     */
    getTicketSubmittedBy: function() {
        return this.ticketData["ticket.requester.email"];
    },

    /**
     * "Másik e-mail címről írt" figyelmeztető szöveg ha nem 
     * egyezik a rendelés feladáskor használt e-mail és a 
     * reklamáció beküldéséhez tartozó e-mail.
     */
    setDifferentEmailWarning: function() {
        if (JateknetApp.order_data) {
            JateknetApp.order_data.zendesk_different_email = 
                JateknetApp.order_data.info.customer_email_address 
                != this.getTicketSubmittedBy();
        }
    },

    /**
     * Ez az üzenet jelenik meg tooltip-ben, ha a "Másik e-mail címről írt"
     * figyelmeztetésre mutatnak az egérrel.
     */
    getDifferentEmailWarning: function() {
        if (!JateknetApp.order_data) {
            return '';
        }
        return "A rendelését a " 
            + JateknetApp.order_data.info.customer_email_address 
            + " e-mail címről küldte, és a " 
            + this.getTicketSubmittedBy()
            + "-ról írt.";
    },

    setClient: function (client) {
      	this.client = client;
    },

    setTicketData: function (ticketData) {
      	this.ticketData = ticketData;
    },

    /**
     * Ha az app beállításainál a debug == true, akkor
     * console.log üzeneteket ír.
     */
    log: function (message1, message2) {
		if (JateknetApp.settings.debug) {
			if (!message2) {
			    message2 = "";
			}
			console.log(message1, message2);
		}
    },

    /**
     * PUT https://jateknet.dev/api/v1/orders/<order ID>
     *     A rendeléshez egy ticket-et rendel a Játéknet adatbázisban.
     * A PUT kérés BODY-ja:
     * {
     *     "action": "ticketToOrder",
     *     "zendesk_ticket_id": <Zendesk ticket ID>
     * }
     *
     */
    putTicketToOrder: function() {
        this.log('putTicketToOrder started');
        // if(JateknetApp.ticketData["ticket.id"]) {
			return $.ajax({
				method: "PUT",
				url: JateknetApp.settings.jateknet_api_root + "orders/" +
				    JateknetApp.getOrderId() +
				    "?auth=" +
				    JateknetApp.getHash(),
				dataType: "json",
				crossDomain: true,
				cache: false,
                data: JSON.stringify({
                    "action": "ticketToOrder",
                    "zendesk_ticket_id": JateknetApp.ticketData["ticket.id"]
                })
			});
        // }
    },

    /**
     * DELETE https://jateknet.dev/api/v1/orders/<order ID>
     *     Törli a rendelés és a ticket kapcsolatát.
     *
     */
    deleteTicketToOrder: function(order_id) {
        if(JateknetApp.ticketData["ticket.id"]) {
			return $.ajax({
				method: "DELETE",
				url: JateknetApp.settings.jateknet_api_root + "orders/" +
                    order_id +
				    "?auth=" +
				    JateknetApp.getHash(),
				dataType: "json",
				crossDomain: true,
				cache: false,
                data: JSON.stringify({
                    "action": "ticketToOrder",
                    "zendesk_ticket_id": JateknetApp.ticketData["ticket.id"]
                })
			});

        }
    },

    /**
     * Beállítja a ticket-hez az OrderId-t.
     *
     * zafClient.set("ticket.customField:custom_field_114101358653", "2222222");
     * zafClient.get("ticket.customField:custom_field_114101358653");
     *
     * @param int Megrendelés azonosító
     */
    setOrderId: function (orderId) {
        if (!orderId) {
            this.log("JateknetApp.setOrderId: nincs orderId beállítva.");
            return;
        }
		if (!this.client) {
            this.log("JateknetApp.setOrderId: nincs client objektum beállítva.");
            return;
        }

        JateknetApp.order_id = orderId;
        var request = this.putTicketToOrder();
        
        request.done(function (response) {
            JateknetApp.log("setOrderId response: ", response);
            if(response.success) {
                JateknetApp.log("Setting up order ID for " + JateknetApp.settings.order_id_ticket_field_name);
                JateknetApp.client.set(JateknetApp.settings.order_id_ticket_field_name, orderId); 
                UI.setupUI();               
            } else {
                JateknetApp.log(response.message);
				UI.alert(response.message);
                JateknetApp.order_id = null;
            }
        });

        request.fail(function (jqXHR, textStatus) {
            UI.displayErrorMessage(textStatus);
        });
        
    },

    /**
     * Beállítja a tickethez "removed" értékűre a rendelés azonosítót.
     * Törli a megrendelés-ticket kapcsolatot a Játéknet API-val is.
     */
    removeOrderId: function () {
		if (this.client) {
            this.deleteTicketToOrder(JateknetApp.order_id);
            this.client.set(JateknetApp.settings.order_id_ticket_field_name, "removed");
			JateknetApp.order_id = null;
		} else {
			JateknetApp.log("JateknetApp.setOrderId: nincs client objektum beállítva.");
		}
    },

    /**
     * A tickethez tartozó megrendelés azonosítót
     * kinyeri a ticket Order ID field-jéből.
     */
    getOrderId: function (orderId) {
      	return JateknetApp.order_id;
    },

    /**
     * Megkeresi a megrendelés azonosítóját a ticketben és
     * megpróbálja beállítani a Jateknet.order_id property-t.
     */
    findOrderId: function () {
        if (!this.ticketData || this.ticketData.order_id == "removed") {
            // Az order_id == removed, emiatt nem keressük az order_id-t
            // az üzenet szövegben.
            return;
        } else if (this.ticketData.order_id) {
            // El van már mentve a tickethez? 
          	JateknetApp.log("El van már tárolva a ticket-ben az Order ID: " + this.ticketData.order_id);
          	this.order_id = this.ticketData.order_id;
        } else {
			// A ticket tárgyában benne van a rendelés ID?
			var subject = this.ticketData["ticket.subject"];
			var pattern = new RegExp("[0-9]{7,8}");
			var orderId = pattern.exec(subject);
			if (orderId) {
				orderId = orderId[0];
				log = " orderId=" + orderId + " ";
			}
			this.order_id = orderId;
        }
        JateknetApp.log("findOrderId result: this.order_id = ", this.order_id);
    },

    /**
     * Előállítja azt a hash értéket, melyet küldözgetni fog az
     * agent webböngészője a Játéknet API hívások során.
     *
     * TODO: Az agent-ek elől védhetjük a tokent: manifest.json-ban
     * token / secure:true - https://developer.zendesk.com/apps/docs/apps-v2/using_sdk#working-with-framework-events
     *  / Testing an app with secure settings locally
     *
     */
    getHash: function () {
        var d = new Date();
        var date = d.toISOString().substring(0, 10);
        return sha1(JateknetApp.settings.jateknet_api_token + date);
    },

    /**
     * Létrehoz egy jQuery ajax objektumot, ami egy megrendelés
     * adatait kérdezi le a Játéknet API-tól.
     */
    getOrderData: function () {
        return $.ajax({
			method: "GET",
			url: JateknetApp.settings.jateknet_api_root + "orders/" + JateknetApp.order_id,
			dataType: "json",
			crossDomain: true,
			cache: false,
			data: {
				"auth": JateknetApp.getHash()
			}
        });
    },

    /**
     * A megrendelések között keres a ticket létrehozójának
     * email címe alapján.
     */
    searchOrderByEmail: function () {
        return $.ajax({
			method: "GET",
            url: JateknetApp.settings.jateknet_api_root 
                + "search/?type=order&email=" 
                + JateknetApp.getTicketSubmittedBy(),
			dataType: "json",
			crossDomain: true,
			cache: false,
			data: {
				"auth": JateknetApp.getHash()
			}
        });
    },    

    setOrderData: function (order_data) {
        this.order_data = order_data;
    },

    /**
     * Elküldi a Zendesk ticket-hez tartozó ticketeket a Játéknet API-nak.
     * Exportáljuk azt a ticket-et is, amelyiket épp most írtunk meg.
     *
     * @example:
     *     var syncHistoryRequest = JateknetApp.syncHistory();
     *     syncHistoryRequest.done(function (response) {
     *         JateknetApp.log("syncHistory response=", response);
     *     });
     *     syncHistoryRequest.fail(function( jqXHR, textStatus ) {
     *         JateknetApp.log("syncHistory response fail=", jqXHR);
     *     });
     *
     */
    syncHistory: function () {

        if (!JateknetApp.getOrderId()) {
            return;
        }

        // Lekérdezi a legfrissebb kommenteket.
        return JateknetApp.client.get([
          	"ticket.comments",
        ]).then(function (response) {

			JateknetApp.log("syncHistory: ", response);

			return $.ajax({
				method: "POST",
				url: JateknetApp.settings.jateknet_api_root + "orders/" +
				    JateknetApp.getOrderId() +
				    "?auth=" +
				    JateknetApp.getHash(),
				dataType: "json",
				crossDomain: true,
				cache: false,
				data: JSON.stringify({
                    "action": "syncHistory",
                    "admin_name":  JateknetApp.ticketData.jn_admin_name,
                    "comments": response["ticket.comments"]
				})
			});

        });
    }

};

// Beállítja a kurzor AJAX hívások közbeni viselkedését.
$(document).ajaxStart(function (){
    $('body').addClass('wait');
}).ajaxComplete(function () {
    $('body').removeClass('wait');
});


var UI = {

    /**
     * Megjelenít egy rövid szöveget az APP területén.
     * Eltűnik 4 másodpercen belül.
     */
    alert: function(message) {
        var persistent = false;
        var target = $('.qtip.jgrowl:visible:last');

        $('<div/>').qtip({
            content: {
                text: message,
                title: {
                    text: "",
                    button: false
                }
            },
            position: {
                target: [0,0],
                container: $('#qtip-growl-container')
            },
            show: {
                event: false,
                ready: true,
                effect: function() {
                    $(this).stop(0, 1).animate({ height: 'toggle' }, 400, 'swing');
                },
                delay: 0,
                persistent: persistent
            },
            hide: {
                event: false,
                effect: function(api) {
                    $(this).stop(0, 1).animate({ height: 'toggle' }, 400, 'swing');
                }
            },
            style: {
                width: 250,
                classes: 'jgrowl',
                tip: true
            },
            events: {
                render: function(event, api) {
                    if(!api.options.show.persistent) {
                        $(this).bind('mouseover mouseout', function(e) {
                            var lifespan = 3000;

                            clearTimeout(api.timer);
                            if (e.type !== 'mouseover') {
                                api.timer = setTimeout(function() { api.hide(e) }, lifespan);
                            }
                        })
                        .triggerHandler('mouseout');
                    }
                }
            }
        });
    },

    /**
     * Beállítja az új megrendelés azonosítót a
     * #new-order-id input értéke alapján.
     */
    setOrderId: function (newOrderId = null) {
        if(!newOrderId) {
            newOrderId = $("#new-order-id").val();
        }
        if (newOrderId.toString().length > 4 && JateknetApp.order_id != newOrderId) {
            JateknetApp.setOrderId(newOrderId);
        }
    },

    /**
     * Törli az megrendelés-ticket kapcsolatot mind a felületen,
     * mind a Játéknet adminban.
     */
    resetOrderId: function () {
        var newOrderId = $("#new-order-id").val("");
        JateknetApp.removeOrderId();
        UI.setupUI();
    },

    /**
     * Definiálja az APP linkjeinek működését.
     */
    setupLinks: function () {
        $(".link-to-order").click(function () {
            window.open(JateknetApp.settings.jateknet_order_edit + $(this).data("orderId"), "_blank");
            //window.open("url", "window name", "window settings");
            return false;
        });

        $(".bind-ticket-to-this-order").click(function () {
            UI.setOrderId();
        });

        $(".orders-bind-to-ticket").click(function () {
            JateknetApp.log("orders-bind-to-ticket clicked: ", $(this).data("order-id"));            
            UI.setOrderId($(this).data("order-id"));
        });


        $("#new-order-id").keyup(function (e) {
            if (e.keyCode == 13) {
                UI.setOrderId();
            }
        });

        $(".remove-ticket-from-order").click(function () {
            UI.resetOrderId();
        });

    },

    /**
     * Felbukkanó súgó a "Másik e-mail címről írt" üzenetre
     * mutatva az egérrel.
     */
    setupTips: function() {
        $('.different-email-warning').qtip({
            content: {
                text: JateknetApp.getDifferentEmailWarning()
            },
            position: {
                target: $('#warning')
            }
        })
    },

    initHandlebars: function() {
        Handlebars.registerHelper('trimDate', function(passedString) {
            var theString = passedString.substring(0, 10);
            return new Handlebars.SafeString(theString)
        });
    },

    /**
     * Megjeleníti a template-et.
     *
     * @param obj templateData
     */
    setupTemplate: function (templateData, templateId = "#template") {
        UI.initHandlebars();
        JateknetApp.log(templateData);
        var source = $(templateId).html();
        var template = Handlebars.compile(source);
        var html = template(templateData);
        $("#content").html(html);
        UI.setupLinks();
        UI.setupTips();
    },

    /**
     * Nincs meg az üzenetben az order ID, emiatt egy listát
     * kér a lehetséges rendelésekről e-mail cím alapján.
     * Nem tartozik a tickethez megrendelés képernyő.
     */
    displayNoOrder: function () {
        if (!this.order_id) {
            var request = JateknetApp.searchOrderByEmail();

            request.done(function (response) {
                JateknetApp.log("searchOrderByEmail response = ", response);
                var templateData;
                try {
                    var templateData = {
                        "orders": response["result"]
                    };
                    JateknetApp.log("templateData = ", templateData);
                } catch (ex) {
                    console.error(ex);
                    var templateData = {
                        "message": "Hiba történt a rendelés adatainak megjelenítése során."
                    };
                }
                JateknetApp.client.invoke("resize", {
                    width: "100%",
                    height: "500px"
                });
                UI.setupTemplate(templateData);
            });

            request.fail(function (jqXHR, textStatus) {
                UI.displayErrorMessage(
                    "Nem tartozik a tickethez rendelés ("
                    + textStatus
                    + ")");
            });
        }
        this.displayErrorMessage();
    },

    /**
     * Hibaüzenetet jelenít meg.
     *
     * @param
     */
    displayErrorMessage: function (message) {
        var templateData = {
            "message": message
        };
        JateknetApp.client.invoke("resize", {
            width: "100%",
            height: "120px"
        });
        UI.setupTemplate(templateData);
    },

    /**
     * Lekérdezi az APP felületéhez szükséges adatokat a
     * Játéknet admintól és megjeleníti a APP felületét.
     *
     * @example UI.setupUI();
     */
    setupUI: function () {
        if (JateknetApp.order_id == null) {
            UI.displayNoOrder();
            return;
        }

        var request = JateknetApp.getOrderData();

        request.done(function (response) {
            JateknetApp.log("getOrderdata response = ", response);
            var templateData;
            try {
                JateknetApp.setOrderData(response["order"]);
                JateknetApp.setDifferentEmailWarning();
                var templateData = {
                    "order": JateknetApp.order_data
                };
            } catch (ex) {
                console.error(ex);
                var templateData = {
                    "message": "Hiba történt a rendelés adatainak megjelenítése során."
                };
            }
            JateknetApp.client.invoke("resize", {
                width: "100%",
                height: "500px"
            });
            UI.setupTemplate(templateData);
        });

        request.fail(function (jqXHR, textStatus) {
            UI.displayErrorMessage(textStatus);
        });
    }

};
with (Hasher('Cart','Application')) {
  before_filter('add_query_string_domains_to_cart', function() {
    var domain_names = (Hasher.request_data.params.domains||"").split(',');
    for (var i=0; i<domain_names.length; i++) add_domain(domain_names[i]);
  });

  define('add_domain', function(domain_name) {
    if (!BadgerCart.find_domain({ name: domain_name })) {
      BadgerCart.push_domain(domain_name);
      update_shopping_cart_size();
    }
  });

  define('add_many_domains_to_cart', function(domains) {
    if (domains.length <= 0) return;

    var before_cart_size = BadgerCart.get_domains().length;
    for (var i=0; i<domains.length; i++) {
      if (!BadgerCart.find_domain({ name: domains[i].name })) {
        add_domain(domains[i]);
        update_shopping_cart_size();
      }
    }
  });

  route('#cart', function() {
    render(
      h1('Shopping Cart'),

      div({ 'class': 'sidebar' },
        info_message(
          h3("Waiting for the expiration?"),
          p("No need. Transferring your domain to Badger extends the current registration by one year.")
        )
      ),

      form_with_loader({ 'class': 'has-sidebar', action: confirm_transfers, loading_message: 'Processing...' },
        div({ id: 'errors' }),

        table({ 'class': 'fancy-table', id: 'transfer-domains-table' },
          tbody(
            tr({ 'class': 'table-header' },
              th('Name'),
              th('Registrar'),
              th('Expires'),
              th()
            ),

            // generate rows for domains
            BadgerCart.get_domains().map(function(d) { return generate_row_for_domain(d.name) }),

            tr({ id: 'add-domain-to-table-row' },
              td(
                textarea({
                  name: 'domains',
                  id: 'add_domain_to_table_text',
                  placeholder: 'e.g. badger.com',
                  onKeydown: function(e) { if ((e.charCode || e.keyCode) == 13) { stop_event(e); process_new_domains(); } },
                  onPaste: function(e) { setTimeout(process_new_domains,0); },
                  style: 'width: 150px; height: 20px; line-height: 20px; border: 1px solid #bbb; padding: 3px; margin: 3px 5px 3px 0; resize: none;'
                }),
                submit({
                  style: 'background: url(images/add.gif); width: 16px; height:16px; border: 0; border: 0; margin: 0; padding: 0; text-indent: -1000px',
                  onClick: function(e) {
                    stop_event(e);
                    process_new_domains();
                  }
                })
              ),
              td({ colSpan: '3' })
            )
          )
        ),

        div({ style: "margin-top: 20px; text-align: right "},
          input({ type: 'hidden', name: 'hidden_tag_anchor', id: 'hidden_tag_anchor', value: '' }),
          submit({ id: 'continue-transfer-btn', 'class': 'myButton', style: 'display: none', name: 'cancel', value: "Proceed to Checkout" })
        )
      )
    );

    // update all of the table rows for domains in the cart
    update_rows_for_shopping_cart_domains();
  });

  define('process_new_domains', function() {
    var raw_domains = document.getElementById('add_domain_to_table_text').value;

    var domains = [];
    (typeof(raw_domains) == "string" ? raw_domains.split('\n') : raw_domains).map(function(domain) {
      if (domain.trim() != '') domains.push(domain.trim().toLowerCase());
    });
    $.unique(domains).sort();
    if (domains.length == 0) {
      $('#transfer-form-error').html('Invalid Domains Input');
      $('#transfer-form-error').removeClass('hidden');
      return;
    }
    domains.map(function(domain) {
      add_domain_to_table({ name: domain });
      add_domain(domain);
    });
    $('#add_domain_to_table_text').val('');

    update_rows_for_shopping_cart_domains();
  });

  route('#cart/confirm', function() {
    var domains = BadgerCart.get_domains(),
      new_domains = BadgerCart.get_new_domains(),
      transfer_domains = BadgerCart.get_transfer_domains(),
      domain_count = domains.length;

    render(
      chained_header_with_links(
        { text: 'Shopping Cart', href: '#cart' },
        { text: 'Confirm Purchase of ' + domain_count + ' ' + (domain_count == 1 ? 'Domain' : 'Domains') }
      ),

      Billing.show_num_credits_added({ delete_var: true }),

      form_with_loader({ 'class': 'fancy has-sidebar', action: register_or_transfer_all_domains, loading_message: 'Processing...' },
        div({ id: 'errors' }),

        fieldset({ style: 'line-height: 25px' },
          label('Domains:'),
          div(
            ul({ style: 'border: 1px solid #ccc; float: left; margin-top: 0px; padding: 5px 20px 5px 30px; max-height: 60px; overflow: auto; line-height: 18px' },
              domains.map(function(domain_obj){
                return li(domain_obj.name);
              })
            )
          )
        ),

        Contact.selector_with_all_form_fields({ name: 'registrant_contact_id' }),

        fieldset({ style: 'line-height: 25px' },
          label('Free options:'),
          div(
            checkbox({ name: 'privacy', value: 'yes', checked: 'checked' }), 'Enable whois privacy'
          ),
          div(
            checkbox({ name: 'auto_renew', value: 'yes', checked: 'checked' }), 'Auto-renew on expiration date'
          )
        ),

        fieldset({ 'class': 'no-label' },
          submit({ name: 'submit', value: 'Purchase ' + domain_count + ' domain' + (domain_count != 1 ? 's' : '') + ' for $' + (domain_count * 10) })
        )
      )
    );
  });

  route('#cart/processing', function() {
    var domains = BadgerCart.get_domains(),
      new_domains = BadgerCart.get_new_domains(),
      transfer_domains = BadgerCart.get_transfer_domains(),
      domain_count = domains.length;

    var credits_added = Badger.Session.get('credits_added'),
      form_data = Badger.Session.get('form_data');

    render(
      chained_header_with_links(
        { text: 'Shopping Cart', href: '#cart' },
        { text: 'Processing ' + domain_count + ' ' + (domain_count == 1 ? 'Domain' : 'Domains') }
      ),

      div({ 'class': 'sidebar' },
        info_message(
          h3('Processing Transfers'),
          p('It will only take a few moments to initiate the domain transfer' + (domain_count != 1 ? 's' : '') + '.')
        )
      ),

      div({ 'class': 'fancy has-sidebar'},
        table({ 'class': 'fancy-table', id: 'transfer-domains-table' },
          tbody(
            tr({ 'class': 'table-header' },
              th('Name'),
              th('Status')
            ),
            domains.map(function(domain_obj) {
              return tr({ id: row_id_for_domain(domain_obj.name), 'class': 'domain-row' },
                td(domain_obj.name),
                td({ 'class': 'status-cell' }, img({ 'class': 'ajax_loader', style: "padding-left: 20px", src: 'images/ajax-loader.gif'}))
              );
            })
          )
        )
      )
    );

    transfer_domains.map(function(domain_obj) {
      var domain_info = {
        name: domain_obj.name,
        registrant_contact_id: form_data.registrant_contact_id,
        auto_renew: form_data.auto_renew,
        privacy: form_data.privacy,
        import_dns: form_data.import_dns
      };

      Badger.transferDomain(domain_info, function(response) {
        if (response.meta.status != 'created') {
          set_background_color_if_valid(domain_obj.name, false);
          $('#' + row_id_for_domain(domain_obj.name) + ' .status-cell').html(response.data.message);
        } else {
          set_background_color_if_valid(domain_obj.name, true);
          $('#' + row_id_for_domain(domain_obj.name) + ' .status-cell').html('Success!');

          domain_obj.remove_from_cart();
        }

        possibly_show_close_button_on_register_screen(domain_count);
        update_shopping_cart_size();
      });
    });

    new_domains.map(function(domain_obj) {
      var domain_info = {
        name: domain_obj.name,
        registrant_contact_id: form_data.registrant_contact_id,
        auto_renew: form_data.auto_renew,
        privacy: form_data.privacy,
        years: (form_data.years ? form_data.years : 1)
      };
      Badger.registerDomain(domain_info, function(response) {
        if (response.meta.status != 'created') {
          set_background_color_if_valid(domain_obj.name, false);
          $('#' + row_id_for_domain(domain_obj.name) + ' .status-cell').html(response.data.message);
        } else {
          set_background_color_if_valid(domain_obj.name, true);
          $('#' + row_id_for_domain(domain_obj.name) + ' .status-cell').html('Success!');

          domain_obj.remove_from_cart();
        }

        possibly_show_close_button_on_register_screen(domain_count);
        update_shopping_cart_size();
      });
    });
  });

  define('generate_row_for_domain', function(domain) {
    return tr({ id: row_id_for_domain(domain), 'class': 'domain-row' },
      td(Domains.truncate_domain_name(domain)),
      td({ 'class': 'registrar_domain' }, img({ 'class': 'ajax_loader', style: "padding-left: 20px", src: 'images/ajax-loader.gif'})),
      td({ 'class': 'expires_domain' }),
      td({ style: 'width: 16px' }, img({ 'class': 'domain_row_trash_icon', src: 'images/trash.gif', onClick: curry(remove_domain_from_table, domain) }))
    );
  });

  // when you want to transfer a domain from somewhere else on the site,
  // invoke this method to make it happen
  define('redirect_to_transfer_for_domain', function(domains) {
    // prepopulate the domains array with this one
    Badger.Session.write({ domains: typeof(domains) == 'string' ? [domains] : domains.unique() });

    set_route('#cart');
  });

  define('row_id_for_domain', function(domain) {
    return domain.replace(/\./g,'-') + '-domain';
  });

  // valid: true - green, false - red, null - white
  define('set_background_color_if_valid', function(domain, valid) {
    var item_id = '#' + row_id_for_domain(domain);
    $(item_id).removeClass("error-row").removeClass("success-row");
    if (valid == true) $(item_id).addClass("success-row");
    if (valid == false) $(item_id).addClass("error-row");
  });

  define('show_error_for_domain', function(domain, message) {
    set_background_color_if_valid(domain, false);
    $('#' + row_id_for_domain(domain) + ' .expires_domain').remove();
    $('#' + row_id_for_domain(domain) + ' .registrar_domain').attr('colSpan', '2').html(span({ 'class': 'error' }, message));
  });


  define('add_domain_to_table', function(form_data) {
    if ($('#' +row_id_for_domain(form_data.name)).length == 0) {
      $('#add-domain-to-table-row').before(generate_row_for_domain(form_data.name));
    }
  });

  define('remove_domain_from_table', function(domain) {
    $('#' + row_id_for_domain(domain)).remove();
    remove_hidden_field_for_domain(domain);
    // remove_domain_from_cart(domain);

    // remove the domain from the cart
    var domain_obj = BadgerCart.find_domain({ name: domain });
    if (domain_obj) {
      domain_obj.remove_from_cart();
      update_shopping_cart_size();
    }
  });

  define('update_shopping_cart_size', function() {
    var cart_size = BadgerCart.get_domains().length,
      cart_size_span = $('#shopping-cart-size');
    cart_size_span.html(BadgerCart.get_domains().length);
    cart_size > 0 ? cart_size_span.show() : cart_size_span.hide();
  });

  define('update_rows_for_shopping_cart_domains', function(callback) {
    var cart_domains = BadgerCart.get_domains(),
      num_domains_updated = 0;

    $('#continue-transfer-btn').hide();

    cart_domains.forEach(function(cart_domain) {
      update_row_for_domain_in_cart(cart_domain, function(updated_domain_obj) {
        // update the domain object in the cart with the updated attributes
        for (k in updated_domain_obj) cart_domain[k] = updated_domain_obj[k];

        if (updated_domain_obj.available || (updated_domain_obj.current_registrar && !updated_domain_obj.current_registrar.match(/^unknown$/i))) num_domains_updated++;
        if (num_domains_updated == cart_domains.length) {
          $('#continue-transfer-btn').show();
          (callback || function(){}).call(cart_domains);
        }
      });
    });
  });

  define('update_row_for_domain_in_cart', function(domain_obj, callback) {
    if (domain_obj.current_registrar && !domain_obj.current_registrar.match(/^unknown$/i)) {
      var item_id = '#' + row_id_for_domain(domain_obj.name);
      if ($(item_id + ' .registrar_domain').length > 0) {
        set_background_color_if_valid(domain_obj.name, true);
        add_hidden_field_for_domain(domain_obj.name, true);
        $(item_id + ' .registrar_domain').html(domain_obj.current_registrar);
        $(item_id + ' .expires_domain').html(domain_obj.expires_at.slice(0,10));
      }
    } else if (domain_obj.available) {
      var item_id = '#' + row_id_for_domain(domain_obj.name);
      if ($(item_id + ' .registrar_domain').length > 0) {
        set_background_color_if_valid(domain_obj.name, true);
        add_hidden_field_for_domain(domain_obj.name, false);
        $(item_id + ' .registrar_domain').html('<i>Register at Badger</i>');
        $(item_id + ' .expires_domain').html('<i>Available!</i>');
      }
    } else {
      Badger.getDomain(domain_obj.name, function(response) {
        var server_domain_obj = response.data;

        if (response.meta.status == 'not_found') {
          show_error_for_domain(domain_obj.name, 'Invalid domain format');
        } else if (response.meta.status != 'ok') {
          show_error_for_domain(domain_obj.name, response.data.message || 'Error: Internal server error');
        } else if (!server_domain_obj.supported_tld) {
          show_error_for_domain(server_domain_obj.name, "Extension ." + server_domain_obj.name.split('.').pop() + " is not currently supported.");
        } else if (server_domain_obj.current_registrar && server_domain_obj.current_registrar.match(/^unknown$/)) {
          // not done loading, try again in a few seconds if the dialog is still open
          if ($('#transfer-domains-table')) setTimeout(curry(update_row_for_domain_in_cart, server_domain_obj, callback), 1500);
        } else {
          return update_row_for_domain_in_cart(server_domain_obj, callback);
        }
      });
    }
    callback(domain_obj);
  });

  define('add_hidden_field_for_domain', function(domain, is_a_transfer) {
    $('#hidden_tag_anchor').after(input({ type: "hidden", name: is_a_transfer ? "transfer_domains[]" : "new_domains[]", value: domain, id: row_id_for_domain(domain + '-hidden') }));
  });

  define('remove_hidden_field_for_domain', function(domain) {
    $('#' + row_id_for_domain(domain + '-hidden')).remove();
    // remove_domain_from_cart(domain);
  });

  define('confirm_transfers', function(form_data) {
    // console.log(form_data);
    set_route('#cart/confirm');
  });

  define('possibly_show_close_button_on_register_screen', function(domain_count) {
    var domain_name = (domain_count == 1) ? $("#transfer-domains-table tr[id$=-domain] td")[0].innerHTML : null;

    if ($('#transfer-domains-table .success-row, #transfer-domains-table .error-row').length == domain_count) {
      $('#transfer-domains-table').after(
        div({ style: 'margin-top: 10px; text-align: right' },
          a({ href: curry(close_transfer, domain_name), 'class': 'myButton' }, 'View My Domains')
        )
      );

      // also, remove the session variables that were set during the transfer process --- CAB
      Badger.Session.remove('transfer_domains', 'new_domains', 'domains', 'domain_count', 'form_data');
    }
  });

  define('register_or_transfer_all_domains', function(form_data) {
    Contact.create_contact_if_necessary_form_data({
      field_name: 'registrant_contact_id',
      form_data: form_data,
      message_area: $('#errors').first(),
      callback: (function() {

        var domain_count = BadgerCart.get_domains().length;

        // TODO update this to work properly when years can be adjusted for each domain in cart
        BadgerCache.getAccountInfo(function(account_info) {
          if (account_info.data.domain_credits < domain_count) {
            // Billing.purchase_modal(curry(register_or_transfer_all_domains, form_data), domain_count - account_info.data.domain_credits);
            // Billing.purchase_modal(curry(confirm_transfers, form_data), domain_count - account_info.data.domain_credits);

            Badger.Session.write({
              form_data: form_data,
              necessary_credits: domain_count - account_info.data.domain_credits,
              redirect_url: '#cart/processing'
            });

            set_route('#account/billing/credits');
          } else {
            Badger.Session.write({ form_data: form_data });
            set_route('#cart/processing');
          }
        });
      })
    });
  });

  define('close_transfer', function(domain_name) {
    BadgerCache.flush('domains');
    BadgerCache.getDomains(function() { update_my_domains_count(); });
    update_credits(true);
    hide_modal();

    domain_name ? set_route('#domains/' + domain_name) : set_route('#domains/pending-transfer');
  });
};



// with (Hasher('Transfer','Application')) {
//   Cart.current_action = 'transfer';
// 
//   define('show', function(registry_transfer_action, domains) {
//     Cart.current_action = (registry_transfer_action ? registry_transfer_action : 'transfer');
//     if (!Badger.getAccessToken()) {
//       Signup.require_user_modal(curry(Cart.show, Cart.current_action));
//       return;
//     }
// 
//     BadgerCache.getContacts(function(contacts) {
//       if (contacts.data.length == 0) {
//         Whois.edit_whois_modal(null, curry(Cart.show, Cart.current_action), "You must have at least one contact profile to " + Cart.current_action + " domain.");
//       } else if (domains) {
//         show_domain_status_table({ domains: domains });
//       } else {
//         transfer_domains_form();
//       }
//     });
//   });
// 
//  define('transfer_domains_form', function(domain) {
//     show_modal(
//       div(
//         Cart.current_action == 'transfer' ? h1('TRANSFER DOMAINS INTO BADGER.COM')
//                              : h1('REGISTER DOMAINS WITH BADGER.COM'),
//         div({ 'class': 'error-message hidden', id: 'transfer-form-error' }),
//         form({ action: show_domain_status_table },
//           p("Enter the domain(s) that you'd like to " + Cart.current_action + ", one per line:"),
// 
//           textarea({ name: 'domains', placeholder: 'badger.com', style: 'width: 80%; height: 75px; float: left' }, domain),
//           div({ style: 'margin-top: 60px; text-align: right' }, input({ 'class': 'myButton', id: 'next', type: 'submit', value: 'Next' })),
//           div({ style: 'clear: both' })
//         )
//       )
//    );
//  });
// 
//   define('row_id_for_domain', function(domain) {
//     return domain.replace(/\./g,'-') + '-domain';
//   });
// 
//   define('show_domain_status_table', function(form_data) {
//     var domains = [];
//     (typeof(form_data.domains) == "string" ? form_data.domains.split('\n') : form_data.domains).map(function(domain) {
//       if (domain.trim() != '') domains.push(domain.trim().toLowerCase());
//     });
//     $.unique(domains).sort();
// 
//     if (domains.length == 0) {
//       $('#transfer-form-error').html('Invalid Domains Input');
//       $('#transfer-form-error').removeClass('hidden');
//       return;
//     }
// 
//     show_modal(
//       form({ action: confirm_transfers },
//         h1(Cart.current_action == 'transfer' ? 'TRANSFER IN DOMAINS' : 'REGISTER DOMAINS'),
//         div({ 'class': 'y-scrollbar-div' },
//           table({ 'class': 'fancy-table', id: 'transfer-domains-table' },
//             tbody(
//               tr({ 'class': 'table-header' },
//                 th('Name'),
//                 th('Registrar'),
//                 th('Expires'),
//                 th()
//               ),
//               domains.map(generate_row_for_domain),
//               tr({ id: 'add-domain-to-table-row' },
//                 td(
//                   form({ action: add_domain_to_table },
//                     text({ name: 'name', id: 'add_domain_to_table_text', placeholder: 'Add another domain...', style: 'width: 150px; border: 1px solid #bbb; padding: 3px; margin: 3px 5px 3px 0' }),
//                     submit({ style: 'background: url(images/add.gif); width: 16px; height:16px; border: 0; border: 0; margin: 0; padding: 0; text-indent: -1000px' })
//                   )
//                 ),
//                 td({ colSpan: '3' })
//               )
//             )
//           )
//         ),
// 
//         div({ style: "margin-top: 20px; text-align: right "},
//           input({ type: 'hidden', name: 'hidden_tag_anchor', id: 'hidden_tag_anchor', value: '' }),
//           submit({ 'id': 'continue-transfer-btn', 'class': 'myButton', value: "Cancel" })
//         )
//       )
//     );
//   });
// 
//   define('generate_row_for_domain', function(domain) {
//     _update_domain_info(domain);
//     return tr({ id: row_id_for_domain(domain), 'class': 'domain-row' },
//       td(domain),
//       td({ 'class': 'registrar_domain' }, img({ 'class': 'ajax_loader', style: "padding-left: 20px", src: 'images/ajax-loader.gif'})),
//       td({ 'class': 'expires_domain' }),
//       td({ style: 'width: 16px' }, img({ 'class': 'domain_row_trash_icon', src: 'images/trash.gif', onClick: curry(remove_domain_from_table,domain) }))
//     );
//   });
// 
//   // valid: true - green, false - red, null - white
//   define('set_background_color_if_valid', function(domain, valid) {
//     var item_id = '#' + row_id_for_domain(domain);
//     $(item_id).removeClass("error-row").removeClass("success-row");
//     if (valid == true) $(item_id).addClass("success-row");
//     if (valid == false) $(item_id).addClass("error-row");
//   });
// 
//   define('show_error_for_domain', function(domain, message) {
//     set_background_color_if_valid(domain, false);
//     $('#' + row_id_for_domain(domain) + ' .expires_domain').remove();
//     $('#' + row_id_for_domain(domain) + ' .registrar_domain').attr('colSpan', '2').html(span({ 'class': 'error' }, message));
//   });
// 
// 
//   define('add_domain_to_table', function(form_data) {
//     if ($('#' +row_id_for_domain(form_data.name)).length == 0) {
//       $('#add-domain-to-table-row').before(generate_row_for_domain(form_data.name));
//       $('#add_domain_to_table_text').val('');
//       update_continue_button_count();
//     }
//   });
// 
//   define('remove_domain_from_table', function(domain) {
//     $('#' + row_id_for_domain(domain)).remove();
//     remove_hidden_field_for_domain(domain);
//     update_continue_button_count();
//   });
// 
//   define('update_continue_button_count', function() {
//     var num = $('#transfer-domains-table .success-row').length;
//     $('#continue-transfer-btn').val(num == 0 ? 'Cancel' : ('Continue with ' + num + ' domain' + (num == 1 ? '' : 's')));
//   });
// 
//   define('_update_domain_info', function(domain) {
//     var item_id = '#' + row_id_for_domain(domain);
// 
//     Badger.getDomain(domain, function(response) {
//       var domain_info = response.data;
// 
//       if (response.meta.status == 'not_found') {
//        show_error_for_domain(domain, 'Invalid domain format');
//       } else if (response.meta.status != 'ok') {
//        show_error_for_domain(domain, response.data.message || 'Error: Internal server error');
//       } else if (domain_info.available) {
//         //show_error_for_domain(domain, 'Domain not currently registered.');
//         set_background_color_if_valid(domain, true);
//         add_hidden_field_for_domain(domain, false);
//         $(item_id + ' .registrar_domain').html('<i>Register at Badger</i>');
//         $(item_id + ' .expires_domain').html('<i>Available!</i>');
//       } else if (!domain_info.supported_tld) {
//         show_error_for_domain(domain, "Extension ." + domain.split('.').pop() + " is not currently supported.");
//       } else if (domain_info.current_registrar == 'Unknown') {
//         // not done loading, try again in a few seconds if the dialog is still open
//         if ($('#transfer-domains-table')) setTimeout(curry(_update_domain_info, domain), 2000);
//       } else {
//         set_background_color_if_valid(domain, true);
//         add_hidden_field_for_domain(domain, true);
//         $(item_id + ' .registrar_domain').html(domain_info.current_registrar);
//         $(item_id + ' .expires_domain').html(domain_info.expires_at.slice(0,10));
//       }
//       update_continue_button_count();
//     });
//   });
// 
//   define('add_hidden_field_for_domain', function(domain, is_a_transfer) {
//     $('#hidden_tag_anchor').after(input({ type: "hidden", name: is_a_transfer ? "transfer_domains[]" : "new_domains[]", value: domain, id: row_id_for_domain(domain + '-hidden') }));
//   });
// 
//   define('remove_hidden_field_for_domain', function(domain) {
//     $('#' + row_id_for_domain(domain + '-hidden')).remove();
//   });
// 
//   define('confirm_transfers', function(form_data) {
//     var transfer_domains = form_data.transfer_domains||[];
//     var new_domains = form_data.new_domains||[];
//     var domain_count = transfer_domains.length + new_domains.length;
//     
//     // close if they clicked "Cancel" button before domains finished loading
//     if (domain_count == 0) return close_transfer_modal();
//     
//     // if the user just added credits to continue, show that message here
//     var credits_added_message = div();
//     
//     
//     
//     // if (credits_added = Badger.Session.get('credits_added')) {
//     //   render({ into: credits_added_div },
//     //     info_message("You have added ", credits_added, " ", credits_added <= 1 ? "Credit" : "Credits", " to your account.")
//     //   )
//     // }
//     
//     
//     
//     if (credits_added = Badger.Session.get('credits_added')) {
//       render({ into: credits_added_message },
//         info_message("You have added ", credits_added, " ", credits_added <= 1 ? "Credit" : "Credits", " to your account.")
//       );
//     }
//     
//     show_modal(
//       h1('CONFIRMATION: ' + domain_count + ' DOMAIN' + (domain_count == 1 ? '' : 'S')),
//       
//       Billing.show_num_credits_added({ delete_var: true }),
// 
//       form({ action: register_or_transfer_all_domains },
//         transfer_domains.map(function(domain) { return input({ type: "hidden", name: "transfer_domains[]", value: domain }); }),
//         new_domains.map(function(domain) { return input({ type: "hidden", name: "new_domains[]", value: domain }); }),
// 
//         table({ style: 'width: 100%' }, tbody(
//           tr(
//             td({ style: 'width: 50%; vertical-align: top'},
//               h3({ style: 'margin-bottom: 3px' }, 'Free Options:'),
//               div(
//                 div(
//                   checkbox({ name: 'privacy', value: 'yes', checked: 'checked' }), 'Enable whois privacy'
//                 ),
// 
//                 div(
//                   checkbox({ name: 'auto_renew', value: 'yes', checked: 'checked' }), 'Auto-renew on expiration date'
//                 )
//               )
//             ),
//             td({ style: 'width: 50%; vertical-align: top'},
//               h3({ style: 'margin-bottom: 3px' }, 'Registrant:'),
//               div(
//                 select({ id: 'registrant_contact_id', name: 'registrant_contact_id', style: 'width: 150px' }, Registration.profile_options_for_select())
//               )
//             )
//           )
//         )),
// 
//         div({ style: "margin-top: 20px; text-align: right "},
//           input({ type: 'hidden', name: 'hidden_tag_anchor', id: 'hidden_tag_anchor', value: '' }),
//           submit({ type: 'submit', 'class': 'myButton', value: 'Register for ' + domain_count + ' Credits' })
//         )
//       )
//     );
//   });
// 
//   define('possibly_show_close_button_on_register_screen', function(domain_count) {
//     var domain_name = (domain_count == 1) ? $("#transfer-domains-table tr[id$=-domain] td")[0].innerHTML : null;
//     
//     if ($('#transfer-domains-table .success-row, #transfer-domains-table .error-row').length == domain_count) {
//       $('#transfer-domains-table').after(
//         div({ style: 'margin-top: 10px; text-align: right' },
//           a({ href: curry(close_transfer_modal, domain_name), 'class': 'myButton' }, 'Close')
//         )
//       );
//     }
//   });
// 
//   define('register_or_transfer_all_domains', function(form_data) {
//     start_modal_spin('Processing...');
// 
//     var transfer_domains = form_data.transfer_domains||[];
//     var new_domains = form_data.new_domains||[];
//     var domains = transfer_domains.concat(new_domains).sort();
//     var domain_count = domains.length;
// 
//     BadgerCache.getAccountInfo(function(account_info) {
//       if (account_info.data.domain_credits < domain_count) {
//         // Billing.purchase_modal(curry(register_or_transfer_all_domains, form_data), domain_count - account_info.data.domain_credits);
//         // Billing.purchase_modal(curry(confirm_transfers, form_data), domain_count - account_info.data.domain_credits);
//         
//         Badger.Session.write({ 
//           necessary_credits: domain_count - account_info.data.domain_credits,
//           callback: curry(confirm_transfers, form_data),
//           redirect_url: '#domain-transfers'
//         });
//         
//         set_route('#account/billing/credits');
//         hide_modal();
//       } else {
//         show_modal(
//           h1('REGISTRATION STATUS'),
//           div({ 'class': 'y-scrollbar-div' },
//             table({ 'class': 'fancy-table', id: 'transfer-domains-table' },
//               tbody(
//                 tr({ 'class': 'table-header' },
//                   th('Name'),
//                   th('Status')
//                 ),
//                 domains.map(function(domain) {
//                   return tr({ id: row_id_for_domain(domain), 'class': 'domain-row' },
//                     td(domain),
//                     td({ 'class': 'status-cell' }, img({ 'class': 'ajax_loader', style: "padding-left: 20px", src: 'images/ajax-loader.gif'}))
//                   );
//                 })
//               )
//             )
//           )
//         );
// 
//         transfer_domains.map(function(domain) {
//           var domain_info = {
//             name: domain,
//             registrant_contact_id: form_data.registrant_contact_id,
//             auto_renew: form_data.auto_renew,
//             privacy: form_data.privacy,
//             import_dns: form_data.import_dns
//           };
//           Badger.transferDomain(domain_info, function(response) {
//             if (response.meta.status != 'created') {
//               set_background_color_if_valid(domain, false);
//               $('#' + row_id_for_domain(domain) + ' .status-cell').html(response.data.message);
//             } else {
//               set_background_color_if_valid(domain, true);
//               $('#' + row_id_for_domain(domain) + ' .status-cell').html('Success!');
//             }
//             possibly_show_close_button_on_register_screen(domain_count);
//           });
//         });
// 
//         new_domains.map(function(domain) {
//           var domain_info = {
//             name: domain,
//             registrant_contact_id: form_data.registrant_contact_id,
//             auto_renew: form_data.auto_renew,
//             privacy: form_data.privacy,
//             years: (form_data.years ? form_data.years : 1)
//           };
//           Badger.registerDomain(domain_info, function(response) {
//             if (response.meta.status != 'created') {
//               set_background_color_if_valid(domain, false);
//               $('#' + row_id_for_domain(domain) + ' .status-cell').html(response.data.message);
//             } else {
//               set_background_color_if_valid(domain, true);
//               $('#' + row_id_for_domain(domain) + ' .status-cell').html('Success!');
//             }
// 
//             possibly_show_close_button_on_register_screen(domain_count);
//           });
//         });
//       }
//     });
//   });
// 
//   define('close_transfer_modal', function(domain_name) {
//     BadgerCache.flush('domains');
//     BadgerCache.getDomains(function() { update_my_domains_count(); });
//     update_credits(true);
//     hide_modal();
//     
//     domain_name ? set_route('#domains/' + domain_name) : set_route('#domain-transfers');
//   });
// 
// 
//   // define('confirm_transfer', function() {
//   //   if ($("#transfer-domains-table .success-row").length > 0 ) {
//   //     var contact_id = $('#registrant_contact_id').val();
//   //     var use_badger_dns = ($("#use_badger_dns").attr('checked') ? $("#use_badger_dns").val() : '');
//   //     var domains_list = $.grep(Cart.domains, function(domain) {
//   //       return domain.auth_code_verified && domain.not_locked && domain.no_privacy;
//   //     })
//   //
//   //     show_modal(
//   //       div(
//   //         h1('CONFIRM TRANSFER'),
//   //         p('You are about to transfer ' + domains_list.length + (domains_list.length > 1 ? ' domains.' : ' domain.')),
//   //         a({ href: curry(proceed_transfer, domains_list, use_badger_dns, contact_id), 'class': 'myButton'}, 'Complete Transfer')
//   //       )
//   //     )
//   //   } else {
//   //     alert("No domains available for transfering")
//   //   }
//   // });
// 
// 
// 
// 
//   // if ($("input[name$=account_id]:checked").length > 0) {
//   //  showSharePreview("\"I just transfered " + $("tr[id$=domain]").length + " " + ($("tr[id$=domain]").length > 1 ? "domains" : "domain") + "  " + ($(".registrar_domain").html() ? "from " + $(".registrar_domain").html() : "") + " to Badger!\"");
//   // }
// 
//   //
//   //
//   //
//   //
//   //
//   //
//   //
//   //
//   //
//   // define('verify_transfer', function(use_badger_dns, contacts_id) {
//   //   start_modal_spin('Processing...');
//   //
//   //   BadgerCache.getAccountInfo(function(account_info) {
//   //     // ensure they have at least one domain_credit
//   //     if (account_info.data.domain_credits < Cart.domains.length) {
//   //       Billing.purchase_modal(curry(Cart.verify_transfer, Cart.domains, use_badger_dns));
//   //     } else {
//   //       confirm_transfer(Cart.domains, use_badger_dns, contacts_id);
//   //     }
//   //   });
//   // });
//   //
//   // define('proceed_transfer', function(domain_list, use_badger_dns, contacts_id) {
//   //   transfer_result(domain_list);
//   //
//   //   var count = -1;
//   //   domain_list.map(function(domain) {
//   //     var domain_info = {
//   //       name: domain.name.toString(),
//   //       auth_code: domain.auth_code,
//   //       auto_renew: 'true',
//   //       privacy: 'true',
//   //       name_servers: (use_badger_dns == "" ? (domain.name_servers || []).join(',') : use_badger_dns),
//   //       registrant_contact_id: contacts_id
//   //     };
//   //     Badger.registerDomain(domain_info, function(response) {
//   //       if (response.meta.status != 'created') {
//   //         $('#' + domain.name.replace(/\./g,'-') + '-transfer-status').html(div({ 'class': "transfer-failed" }, 'Failed'));
//   //       } else {
//   //         $('#' + domain.name.replace(/\./g,'-') + '-transfer-status').html(div({ 'class': "transfer-success" }, 'Success!'));
//   //       }
//   //     });
//   //   });
//   // });
//   //
//   // define('transfer_domains_list', function() {
//   //   var count = -1;
//   //
//   // });
//   //
//   //
//   // define('update_all_domains_info', function(domain) {
//   //   Cart.domains.map(_update_domain_info);
//   // });
//   //
//   //
//   //
//   //
//   // define('help_question_mark', function() {
//   //   return a({ href: '#knowledge_center', target: '_blank' }, '?');
//   // });
//   //
//   // define('ajax_loader', function() {
//   //   return ;
//   // });
//   //
//   // define('show_ajax_spinner', function(domain) {
//   //   $('#' + row_id_for_domain(domain) + ' .ajax_loader').removeClass("hidden");
//   // });
//   //
//   // define('hide_ajax_spinner', function(domain) {
//   //   if(domain.auth_code_verified != null && domain.not_locked != null && domain.no_privacy != null) {
//   //     $('#' + row_id_for_domain(domain) + ' .ajax_loader').addClass("hidden");
//   //   }
//   // });
//   //
//   //
//   // define('auth_code_input', function(domain) {
//   //   return text({ 'class': 'auth-code-input', events: {
//   //     keyup: function(event){
//   //       if(event.keyCode == 13){
//   //         domain.auth_code = $(this).val();
//   //         verify_auth_code(domain)
//   //       }
//   //     }
//   //   }})
//   // });
//   //
//   // define('checked_valid_row', function(domain) {
//   //   if(domain.auth_code_verified && domain.not_locked && domain.no_privacy) {
//   //     set_background_color_if_valid(domain, true);
//   //     $('#continue-transfer-btn').html('Continue with ' + $("#transfer-domains-table .success-row").length +  ' Domain' + ($("#transfer-domains-table .success-row").length == 1 ? '' : 's'));
//   //   }
//   // });
//   //
//   // define('verify_auth_code', function(domain) {
//   //   var item_id = '#' + row_id_for_domain(domain);
//   //
//   //   if ($(item_id + ' .auth-code-input').val()) domain.auth_code = $(item_id + ' .auth-code-input').val();
//   //
//   //   show_ajax_spinner(domain);
//   //   if (domain.auth_code != null && domain.auth_code != "") {
//   //     Badger.getDomain(domain.name, { auth_code: domain.auth_code }, function(response) {
//   //       if (response.data.code == 2202 || response.meta.status != 'ok') {
//   //         // failed
//   //         domain.auth_code_verified = false;
//   //         $(item_id + ' .auth_code_domain').html(auth_code_input(domain));
//   //       } else {
//   //         // ok
//   //         domain.auth_code_verified = true;
//   //         checked_valid_row(domain);
//   //         $(item_id + ' .auth_code_domain').html("Ok")
//   //       }
//   //       hide_ajax_spinner(domain);
//   //     });
//   //   } else {
//   //     hide_ajax_spinner(domain);
//   //     domain.auth_code_verified = false;
//   //     $(item_id + ' .auth_code_domain').html(auth_code_input(domain));
//   //   }
//   // });
//   //
//   // define('transfer_result', function(domains_list) {
//   //   var count = -1;
//   //   var list = domains_list.map(function(domain) {
//   //     return tr(
//   //       td(domain.name),
//   //       td(domain.auth_code),
//   //       td({ id: domain.name.replace(/\./g,'-') + '-transfer-status' }, div({ 'class': "transfer-processing" }, 'Processing'))
//   //     )
//   //   });
//   //
//   //   var modal = show_modal(
//   //     h1('TRANSFER RESULT'),
//   //     div({ 'class': 'y-scrollbar-div' },
//   //       table({ 'class': 'fancy-table', id: 'transfer-result-table' },
//   //         tbody(
//   //           tr(
//   //             th('Domain Name'),
//   //             th('Authentication Code'),
//   //             th('Transfer Status')
//   //           ),
//   //           list
//   //         )
//   //       )
//   //     ),
//   //     div({ style: 'text-align: right; margin-top: 10px;', id: "close-transfer-button" }, ajax_loader())
//   //   );
//   //
//   //   // If all processing elements are gone, show the button. If all succeeded, make button go to share dialog, otherwise hide modal.
//   //   var timer = setInterval(function() {
//   //     if ($("div.transfer-processing").length == 0) {
//   //       clearTimeout(timer);
//   //
//   //       if ($("div.transfer-failed").length > 0) {
//   //         $("#close-transfer-button").html(
//   //           a({ href: hide_modal, 'class': 'myButton', value: "submit" }, "Close")
//   //         );
//   //       } else {
//   //         $("#close-transfer-button").html(
//   //           a({ href: curry(Share.show_share_transfer_modal, domains_list.length), 'class': 'myButton', value: "submit" }, "Continue")
//   //         );
//   //       }
//   //     }
//   //   }, 200);
//   //
//   //   return modal;
//   // });
// 
// }
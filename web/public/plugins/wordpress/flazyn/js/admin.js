(function($) {
    $(document).ready(function() {
        $('#flazyn-test-btn').on('click', function() {
            var btn = $(this);
            btn.prop('disabled', true).text('Testing...');
            $('#flazyn-test-result').html('');
            $.post(crmFinalAjax.ajaxUrl, {
                action: 'flazyn_test_connection',
                nonce: crmFinalAjax.nonce
            }, function(resp) {
                btn.prop('disabled', false).text('Test Connection');
                if (resp.success) {
                    $('#flazyn-test-result').html('<div class="success">' + resp.data.message + '</div>');
                } else {
                    $('#flazyn-test-result').html('<div class="error">' + resp.data.message + '</div>');
                }
            }).fail(function() {
                btn.prop('disabled', false).text('Test Connection');
                $('#flazyn-test-result').html('<div class="error">Request failed</div>');
            });
        });
    });
})(jQuery);

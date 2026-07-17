(function($) {
    $(document).ready(function() {
        $('#crm-final-test-btn').on('click', function() {
            var btn = $(this);
            btn.prop('disabled', true).text('Testing...');
            $('#crm-final-test-result').html('');
            $.post(crmFinalAjax.ajaxUrl, {
                action: 'crm_final_test_connection',
                nonce: crmFinalAjax.nonce
            }, function(resp) {
                btn.prop('disabled', false).text('Test Connection');
                if (resp.success) {
                    $('#crm-final-test-result').html('<div class="success">' + resp.data.message + '</div>');
                } else {
                    $('#crm-final-test-result').html('<div class="error">' + resp.data.message + '</div>');
                }
            }).fail(function() {
                btn.prop('disabled', false).text('Test Connection');
                $('#crm-final-test-result').html('<div class="error">Request failed</div>');
            });
        });
    });
})(jQuery);

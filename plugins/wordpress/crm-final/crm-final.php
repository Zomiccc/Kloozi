<?php
/**
 * Plugin Name: CRM Final
 * Plugin URI: https://crm-final.com
 * Description: Automatically send leads from WordPress contact forms to your CRM Final account.
 * Version: 1.0.0
 * Author: CRM Final
 * License: GPL-2.0+
 * Text Domain: crm-final
 */

if (!defined('ABSPATH')) exit;

define('CRM_FINAL_VERSION', '1.0.0');
define('CRM_FINAL_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('CRM_FINAL_PLUGIN_URL', plugin_dir_url(__FILE__));

class CRM_Final_Plugin {

    private $settings;

    public function __construct() {
        $this->settings = get_option('crm_final_settings', array());
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_scripts'));
        add_action('wpforms_process_complete', array($this, 'handle_wpforms'), 10, 4);
        add_action('wpcf7_mail_sent', array($this, 'handle_cf7'));
        add_action('elementor_pro/forms/new_record', array($this, 'handle_elementor'), 10, 2);
        add_action('ninja_forms_after_submission', array($this, 'handle_ninja_forms'));
        add_action('gform_after_submission', array($this, 'handle_gravity_forms'), 10, 2);
        add_action('frm_after_create', array($this, 'handle_formidable'), 10, 2);
        add_action('fluentform/submission_inserted', array($this, 'handle_fluent_forms'), 10, 3);
        add_action('everest_forms_after_submission', array($this, 'handle_everest_forms'));
        add_action('metform_after_submission', array($this, 'handle_metform'), 10, 3);
        add_action('forminator_custom_form_submit', array($this, 'handle_forminator'), 10, 2);
        add_action('et_pb_contact_form_submit', array($this, 'handle_divi_forms'), 10, 2);
        add_action('houzez_after_submit_listing', array($this, 'handle_houzez'));
        add_action('wp_ajax_crm_final_test_connection', array($this, 'ajax_test_connection'));
    }

    public function add_admin_menu() {
        add_menu_page('CRM Final', 'CRM Final', 'manage_options', 'crm-final', array($this, 'render_settings_page'), 'dashicons-feedback', 80);
    }

    public function enqueue_admin_scripts($hook) {
        if ('toplevel_page_crm-final' !== $hook) return;
        wp_enqueue_style('crm-final-admin', CRM_FINAL_PLUGIN_URL . 'css/admin.css', array(), CRM_FINAL_VERSION);
        wp_enqueue_script('crm-final-admin', CRM_FINAL_PLUGIN_URL . 'js/admin.js', array('jquery'), CRM_FINAL_VERSION, true);
        wp_localize_script('crm-final-admin', 'crmFinalAjax', array('ajaxUrl' => admin_url('admin-ajax.php'), 'nonce' => wp_create_nonce('crm-final-nonce')));
    }

    public function register_settings() {
        register_setting('crm_final_settings_group', 'crm_final_settings', array($this, 'sanitize_settings'));
    }

    public function sanitize_settings($input) {
        return array(
            'account_token' => sanitize_text_field($input['account_token'] ?? ''),
            'site_name' => sanitize_text_field($input['site_name'] ?? ''),
            'api_url' => esc_url_raw($input['api_url'] ?? 'http://localhost:5000'),
        );
    }

    public function render_settings_page() {
        $settings = $this->settings;
        $connected = !empty($settings['account_token']);
        ?>
        <div class="wrap crm-final-wrap">
            <div class="crm-final-header">
                <div class="crm-final-logo"><span class="dashicons dashicons-feedback"></span></div>
                <h1>CRM Final</h1>
                <p>Send leads from your WordPress forms directly to CRM Final</p>
            </div>
            <?php if ($connected): ?>
                <div class="crm-final-status connected"><span class="dashicons dashicons-yes-alt"></span> Connected — leads are being sent to CRM Final</div>
            <?php else: ?>
                <div class="crm-final-status disconnected"><span class="dashicons dashicons-warning"></span> Not connected — enter your account token below</div>
            <?php endif; ?>
            <form method="post" action="options.php">
                <?php settings_fields('crm_final_settings_group'); ?>
                <table class="form-table">
                    <tr><th scope="row"><label for="crm_final_account_token">Account Token</label></th>
                        <td><input type="text" id="crm_final_account_token" name="crm_final_settings[account_token]" value="<?php echo esc_attr($settings['account_token'] ?? ''); ?>" class="regular-text" placeholder="Paste your CRM Final account token" />
                        <p class="description">Find your token in CRM Final &rarr; Automations &rarr; WordPress Integration</p></td>
                    </tr>
                    <tr><th scope="row"><label for="crm_final_site_name">Website Name (optional)</label></th>
                        <td><input type="text" id="crm_final_site_name" name="crm_final_settings[site_name]" value="<?php echo esc_attr($settings['site_name'] ?? ''); ?>" class="regular-text" placeholder="e.g. My Property Site" />
                        <p class="description">Shown on lead alerts to identify which site the lead came from</p></td>
                    </tr>
                    <tr><th scope="row"><label for="crm_final_api_url">CRM API URL</label></th>
                        <td><input type="url" id="crm_final_api_url" name="crm_final_settings[api_url]" value="<?php echo esc_attr($settings['api_url'] ?? 'http://localhost:5000'); ?>" class="regular-text" />
                        <p class="description">Only change if self-hosting CRM Final</p></td>
                    </tr>
                </table>
                <h2>Supported Form Plugins</h2>
                <div class="crm-final-forms-grid">
                    <?php
                    $supported = array('WPForms'=>'wpforms','Contact Form 7'=>'wpcf7','Elementor Forms'=>'elementor','Ninja Forms'=>'ninja-forms','Gravity Forms'=>'gravityforms','Formidable Forms'=>'formidable','Fluent Forms'=>'fluentform','Everest Forms'=>'everest-forms','MetForm'=>'metform','Forminator'=>'forminator','Divi Forms'=>'divi','Houzez'=>'houzez');
                    foreach ($supported as $name => $slug):
                        $active = $this->is_plugin_active($slug);
                    ?>
                        <div class="crm-final-form-card <?php echo $active ? 'active' : 'inactive'; ?>">
                            <span class="dashicons <?php echo $active ? 'dashicons-yes-alt' : 'dashicons-minus'; ?>"></span>
                            <?php echo esc_html($name); ?>
                            <small><?php echo $active ? 'Active' : 'Not installed'; ?></small>
                        </div>
                    <?php endforeach; ?>
                </div>
                <p class="submit">
                    <?php submit_button('Save Settings', 'primary', 'submit', false); ?>
                    <button type="button" id="crm-final-test-btn" class="button button-secondary">Test Connection</button>
                </p>
            </form>
            <div id="crm-final-test-result"></div>
        </div>
        <?php
    }

    private function is_plugin_active($slug) {
        $active = get_option('active_plugins', array());
        foreach ($active as $plugin) {
            if (strpos($plugin, $slug) !== false) return true;
        }
        return false;
    }

    private function send_lead($data) {
        $token = $this->settings['account_token'] ?? '';
        if (empty($token)) { error_log('[CRM Final] No account token — skipping'); return false; }
        $api_url = rtrim($this->settings['api_url'] ?? 'http://localhost:5000', '/');
        $site_name = $this->settings['site_name'] ?? '';
        if ($site_name) $data['source'] = $site_name;
        $endpoint = $api_url . '/api/integrations/lead/' . $token . '/wordpress';
        $response = wp_remote_post($endpoint, array(
            'headers' => array('Content-Type' => 'application/json', 'Accept' => 'application/json'),
            'body' => json_encode($data), 'timeout' => 15,
        ));
        if (is_wp_error($response)) { error_log('[CRM Final] Error: ' . $response->get_error_message()); return false; }
        $code = wp_remote_retrieve_response_code($response);
        if ($code >= 200 && $code < 300) { error_log('[CRM Final] Lead sent OK'); return true; }
        error_log('[CRM Final] API error ' . $code . ': ' . wp_remote_retrieve_body($response));
        return false;
    }

    private function normalize_fields($fields) {
        $lead = array();
        foreach ($fields as $key => $val) {
            if (is_array($val)) $val = implode(', ', $val);
            $lower = strtolower(trim($key));
            if (in_array($lower, array('name','full_name','your-name')) && empty($lead['name'])) $lead['name'] = $val;
            elseif (in_array($lower, array('first_name','firstname','your-first-name')) && empty($lead['first_name'])) $lead['first_name'] = $val;
            elseif (in_array($lower, array('last_name','lastname','your-last-name')) && empty($lead['last_name'])) $lead['last_name'] = $val;
            elseif (in_array($lower, array('phone','phone_number','tel','your-phone','mobile','your-mobile')) && empty($lead['phone'])) $lead['phone'] = $val;
            elseif (in_array($lower, array('email','email_address','your-email')) && empty($lead['email'])) $lead['email'] = $val;
            elseif (in_array($lower, array('city','location','your-city')) && empty($lead['city'])) $lead['city'] = $val;
            elseif (in_array($lower, array('budget','price','budget_range','your-budget')) && empty($lead['budget'])) $lead['budget'] = $val;
            elseif (in_array($lower, array('message','notes','comments','your-message','comment')) && empty($lead['message'])) $lead['message'] = $val;
            else $lead['fields'][$key] = $val;
        }
        return $lead;
    }

    // ─── WPForms ───
    public function handle_wpforms($fields, $entry, $form_data, $entry_id) {
        $mapped = array();
        foreach ($fields as $field) {
            $mapped[$field['name']] = $field['value'];
        }
        $this->send_lead($this->normalize_fields($mapped));
    }

    // ─── Contact Form 7 ───
    public function handle_cf7($contact_form) {
        $submission = WPCF7_Submission::get_instance();
        if (!$submission) return;
        $data = $submission->get_posted_data();
        $this->send_lead($this->normalize_fields($data));
    }

    // ─── Elementor Forms ───
    public function handle_elementor($record, $handler) {
        $fields = $record->get('fields');
        $mapped = array();
        foreach ($fields as $field) {
            $mapped[$field['id']] = $field['value'];
        }
        $this->send_lead($this->normalize_fields($mapped));
    }

    // ─── Ninja Forms ───
    public function handle_ninja_forms($form_data) {
        $mapped = array();
        foreach ($form_data['fields'] as $field) {
            $mapped[$field['key']] = $field['value'];
        }
        $this->send_lead($this->normalize_fields($mapped));
    }

    // ─── Gravity Forms ───
    public function handle_gravity_forms($entry, $form) {
        $mapped = array();
        foreach ($form['fields'] as $field) {
            $mapped[$field['label']] = rgar($entry, $field['id']);
        }
        $this->send_lead($this->normalize_fields($mapped));
    }

    // ─── Formidable Forms ───
    public function handle_formidable($entry_id, $form_id) {
        $mapped = array();
        $fields = FrmField::get_all_for_form($form_id);
        foreach ($fields as $field) {
            $mapped[$field->name] = FrmEntry::get_field_value($field->id, $entry_id);
        }
        $this->send_lead($this->normalize_fields($mapped));
    }

    // ─── Fluent Forms ───
    public function handle_fluent_forms($insert_id, $form_id, $form_data) {
        $mapped = array();
        foreach ($form_data as $key => $val) {
            if (is_array($val) && isset($val['label'])) $mapped[$val['label']] = $val['value'];
            else $mapped[$key] = $val;
        }
        $this->send_lead($this->normalize_fields($mapped));
    }

    // ─── Everest Forms ───
    public function handle_everest_forms($form_data) {
        $mapped = array();
        foreach ($form_data['fields'] as $field) {
            $mapped[$field['label']] = $field['value'];
        }
        $this->send_lead($this->normalize_fields($mapped));
    }

    // ─── MetForm ───
    public function handle_metform($form_id, $form_data, $form_settings) {
        $this->send_lead($this->normalize_fields($form_data));
    }

    // ─── Forminator ───
    public function handle_forminator($form, $response) {
        $mapped = array();
        foreach ($form->fields as $field) {
            $mapped[$field->slug] = $response[$field->slug] ?? '';
        }
        $this->send_lead($this->normalize_fields($mapped));
    }

    // ─── Divi Forms ───
    public function handle_divi_fields($fields, $et_contact_error) {
        if ($et_contact_error) return;
        $this->send_lead($this->normalize_fields($fields));
    }

    // ─── Houzez ───
    public function handle_houzez() {
        $data = array(
            'name' => sanitize_text_field($_POST['name'] ?? ''),
            'email' => sanitize_email($_POST['email'] ?? ''),
            'phone' => sanitize_text_field($_POST['phone'] ?? ''),
            'message' => sanitize_textarea_field($_POST['message'] ?? ''),
        );
        $this->send_lead($this->normalize_fields($data));
    }

    // ─── AJAX Test Connection ───
    public function ajax_test_connection() {
        check_ajax_referer('crm-final-nonce', 'nonce');
        $token = $this->settings['account_token'] ?? '';
        if (empty($token)) {
            wp_send_json_error(array('message' => 'No account token configured. Save settings first.'));
        }
        $api_url = rtrim($this->settings['api_url'] ?? 'http://localhost:5000', '/');
        $test_data = array(
            'first_name' => 'Test',
            'last_name' => 'Connection',
            'email' => 'test@crm-final.com',
            'phone' => '+10000000000',
            'message' => 'This is a test lead from WordPress plugin',
            'source' => $this->settings['site_name'] ?? 'WordPress Test',
        );
        $endpoint = $api_url . '/api/integrations/lead/' . $token . '/wordpress';
        $response = wp_remote_post($endpoint, array(
            'headers' => array('Content-Type' => 'application/json'),
            'body' => json_encode($test_data), 'timeout' => 15,
        ));
        if (is_wp_error($response)) {
            wp_send_json_error(array('message' => 'Connection failed: ' . $response->get_error_message()));
        }
        $code = wp_remote_retrieve_response_code($response);
        if ($code >= 200 && $code < 300) {
            wp_send_json_success(array('message' => 'Connection successful! A test lead was sent.'));
        }
        wp_send_json_error(array('message' => 'API returned status ' . $code));
    }
}

new CRM_Final_Plugin();

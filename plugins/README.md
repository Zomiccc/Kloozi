# Flazyn Plugins

Real, functional plugins that send leads from external platforms to your Flazyn instance.

## WordPress Plugin

**Location:** `wordpress/flazyn/`

### Installation
1. Zip the `flazyn` folder: `zip -r flazyn.zip flazyn/`
2. In WordPress admin: Plugins > Add New > Upload Plugin > choose `flazyn.zip`
3. Activate the plugin
4. Go to Flazyn in the admin sidebar
5. Enter your account token (from Flazyn > Automations > WordPress Integration)
6. Click Save Settings, then Test Connection

### Supported Form Plugins (12)
WPForms, Contact Form 7, Elementor Forms, Ninja Forms, Gravity Forms, Formidable Forms, Fluent Forms, Everest Forms, MetForm, Forminator, Divi Forms, Houzez

### How It Works
The plugin hooks into each form plugin's submission action (`wpforms_process_complete`, `wpcf7_mail_sent`, etc.), extracts field data, normalizes it (maps name/phone/email/city/budget/message fields), and sends a POST request to:
```
POST {API_URL}/api/integrations/lead/{account_token}/wordpress
```

### Files
- `flazyn.php` — Main plugin file with all form hooks and admin settings
- `css/admin.css` — Admin settings page styling
- `js/admin.js` — AJAX test connection handler
- `readme.txt` — WordPress plugin readme
- `uninstall.php` — Cleanup on uninstall

---

## Google Forms Add-on

**Location:** `google-forms/`

### Installation
1. Open your Google Form
2. Click three dots menu (top right) > Script editor
3. Paste the contents of `Code.gs`
4. Replace `YOUR_ACCOUNT_TOKEN` in the CONFIG object with your token from Flazyn > Automations > Google Forms
5. Optionally set `SITE_NAME` to identify which form this is
6. Click Run > `setupTriggers` (authorize permissions when prompted)
7. Submit a test form response to verify

### Functions
- `setupTriggers()` — Installs the onFormSubmit trigger
- `removeTriggers()` — Removes all Flazyn triggers
- `onFormSubmit(e)` — Automatically called on each form submission, extracts lead data and sends to CRM
- `testConnection()` — Sends a test lead to verify connectivity

### How It Works
On each Google Form submission, the script:
1. Extracts all question titles and answers
2. Maps them to CRM fields (name, phone, email, city, budget, message) by matching keywords
3. Splits full name into first/last if individual fields aren't present
4. Sends a POST to `{API_URL}/api/integrations/lead/{token}/google_forms`

### Files
- `Code.gs` — Main Apps Script with all functions
- `appsscript.json` — Manifest with required OAuth scopes

---

## Backend API

Both plugins use the token-based webhook endpoint:
```
POST /api/integrations/lead/:token
POST /api/integrations/lead/:token/:type
```

The `:token` is the workspace's `account_token` (auto-generated, found in Flazyn > Automations > any integration page).

### Accepted Fields
| Field | Aliases |
|-------|---------|
| first_name | name (auto-split) |
| last_name | |
| phone | phone_number, mobile |
| email | email_address |
| city | location |
| budget | price |
| message | notes, comments |
| source | (optional site name) |
| fields | (object of custom fields) |

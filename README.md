# GitHub Issues to Totango

This action takes new issues from GitHub and sends them to Totango.

## Inputs

### `ACCOUNT_ID`

**Required** The customer account id.
> Browse to the Account Overview page in Totango > Click All to see all the data > Scroll down to the Account Identifier section. This is also available in the URL.

### `APP_TOKEN`

**Required** This is your API token
> In Totango, click your picture > Edit Profile > Integrations > Copy your API Token Key

### `ACTIVITY_TYPE`

**Required** This is the desired activity type from the Success Flow section.

### `TOUCHPOINT_REASON`

**Required** The GUID of the Touchpoint Reason.
> This value is difficult to find. You may need to `GET` the Touchpoint Reason from the API. Fetch `https://api.totango.com/api/v2/events/?account_id=abcxyz0123456789` then look at `response.properties.touchpoint_tags`.

## Outputs

### `touchpoint_id`

The id that Totango returns to you when you create a new touchpoint.

## Example usage

``` yaml
uses: jmassardo/issues-to-totango@v1.1
with:
  ACCOUNT_ID: "abcxyz0123456789"
  APP_TOKEN: "0123456789abcdef0123456789abcdef@domain.tld"
  ACTIVITY_TYPE: "adoption"
  TOUCHPOINT_REASON: "e53621bc-f66a-49f0-a886-537b5c64df22"
```
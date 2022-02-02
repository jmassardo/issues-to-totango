# GitHub Issues to Totango

This action takes new issues from GitHub and sends them to Totango.

## Limitations and known issues

* This action only handles three use cases: 
  * When user creates a new issue, contents of that issue are logged as a new touchpoint based on the customer id provided in the workflow.
  * Similarly, issue comments are also logged as new touchpoints
  * Touchpoints are also created when issues are closed.
* [Totango's API](https://support.totango.com/hc/en-us/articles/115000597266-Touchpoints-API) does not support markup of any kind so all formatting gets stripped.

Feature requests are welcome. Please log an issue in this repo for new requests.

## Inputs

### `ACCOUNT_ID`

**Required** The customer account id.
> Browse to the Account Overview page in Totango > Click All to see all the data > Scroll down to the Account Identifier section. This is also available in the URL.

### `APP_TOKEN`

**Required** This is your API token
> In Totango, click your picture > Edit Profile > Integrations > Copy your API Token Key

### `ACTIVITY_TYPE`

**Required** This is ID of the desired activity type from the Success Flow section.
> Fetch `https://api.totango.com/api/v3/activity-types/` to see the parings. Use the `activity_type_id` value.

### `TOUCHPOINT_TAGS`

**Required** The GUID of the Touchpoint Reason.
> Fetch `https://api.totango.com/api/v3/touchpoint-tags/` to see the parings. Use the `ID` value.

### `TOUCHPOINT_TYPE`

**Required** The GUID of the Touchpoint Type.
> Fetch `https://api.totango.com/api/v3/touchpoint-types/` to see the pairings. Use the `ID` value.

## Outputs

### `touchpoint_id`

The id that Totango returns to you when you create a new touchpoint.

## Example usage

``` yaml
uses: jmassardo/issues-to-totango@main
with:
  ACCOUNT_ID: "abcxyz0123456789"
  APP_TOKEN: "0123456789abcdef0123456789abcdef@domain.tld"
  ACTIVITY_TYPE: "adoption"
  TOUCHPOINT_TAGS: "e53621bc-f66a-49f0-a886-537b5c64df22"
  TOUCHPOINT_TYPE: "asdff3e5-cd3d-af42-ax3c-adsf2342c324"
```

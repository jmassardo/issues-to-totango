# GitHub Issues to Totango

This repository contains a GitHub Action which can be used with a repository to automatically create `task` and `touchpoint` data types in Totango with GitHub Issues.

The contents of this repository are community-maintained and are not a direct contribution from GitHub as an organization.  References to `GitHub Actions` in terminology in this repository are for reference only to GitHub technologies and in no way associated with official branding or supportability.

## Limitations and Known Issues

* See [Issues](https://github.com/jmassardo/issues-to-totango/issues) for current bugs (labeled `[bug]`)
* Logic for editing comments on issues has not been handled

Feature requests are welcome. Please log an issue in this repo for new requests.

## Usage

This action should be used in a repository in combination with Issues, triggering from `issues` and `issue_comment` event types.

### Migrating from v1.2 to v2.0

If currently using v1.2 (or below), you will need to take the following steps to use v2.0:

* Create the labels `task` and `touchpoint` in the repo where the action will be run. See [managing labels](https://docs.github.com/en/issues/using-labels-and-milestones-to-track-work/managing-labels#creating-a-label) for more information.
* (Optional) Remove the `totango-sync` label from the repo. See [deleting a label](https://docs.github.com/en/issues/using-labels-and-milestones-to-track-work/managing-labels#deleting-a-label) for help.
* Edit the original workflow file to match [this workflow](https://github.com/jmassardo/issues-to-totango/blob/version2.0/examples/workflow_example.yml) and change the VERSION to v2.0 in the workflow steps. Commit it to the repo.
* Add the following [task template](https://github.com/jmassardo/issues-to-totango/blob/version2.0/examples/task_issue_template_example.md)  to the ISSUE_TEMPLATES folder in the repo and commit
* Add a configuration variable to the repo for the TOTANGO_TASK_ASSIGNEE input. This should be the email in Totango of the user who will be assigned tasks. For help, see [Creating configuration variables for a repository](https://docs.github.com/en/enterprise-cloud@latest/actions/learn-github-actions/variables#creating-configuration-variables-for-a-repository)
* (Optional) Change the following repo secrets to configuration variables:
  * TOTANGO_ACTIVITY_TYPE
  * TOTANGO_TOUCHPOINT_TAGS
  * TOTANGO_TOUCHPOINT_TYPE

  **NOTE**:  If you decide --not-- to change these from repo secrets to configuration variables, you will need to edit the workflow file to use the secrets context rather than the vars context, as in the original v1.0-v1.2 workflow file.
* If using an ISSUE_TEMPLATE for touchpoints, edit the template to use the `touchpoint` label rather than the `totango-sync` label

### Action Inputs

The following `inputs` are used by this Action.  These values should be available as secrets or variables to the repository which runs this Action. **Note**: The workflow example prepends TOTANGO_ to the beginning of the names of the inputs for secrets and variables.

* `ACCOUNT_ID`: **Required**, `string`

  The Totango customer account id.

  > Browse to the Account Overview page in Totango > Click All to see all the data > Scroll down to the Account Identifier section. This is also available in the URL.

* `APP_TOKEN`: **Required**, `string`

  This is your API token.

  > In Totango, click your picture > Edit Profile > Integrations > Copy your API Token Key

* `ACTIVITY_TYPE`: **Required**, `string`

  This is ID of the desired activity type from the Success Flow section.

  > Fetch `https://api.totango.com/api/v3/activity-types/` to see the parings. Use the `activity_type_id` value.

  Example curl request to fetch available activity types:

  ```sh
  curl --location --request GET 'https://api.totango.com/api/v3/activity-types/' \
  --header 'app-token: TOTANGO_TOKEN'
  ```

* `TOUCHPOINT_TAGS`: **Required**, `string` or comma-separated list of `string` values

  The GUID of the Touchpoint Reason.

  > Fetch `https://api.totango.com/api/v3/touchpoint-tags/` to see the parings. Use the `ID` value.

  Example curl request to fetch available values:

  ```sh
  curl --location --request GET 'https://api.totango.com/api/v3/touchpoint-tags/' \
  --header 'app-token: TOTANGO_TOKEN'
  ```

* `TOUCHPOINT_TYPE`: **Required**, `string`

  The GUID of the Touchpoint Type.

  > Fetch `https://api.totango.com/api/v3/touchpoint-types/` to see the pairings. Use the `ID` value.

  Example curl request:

  ```sh
  curl --location --request GET 'https://api.totango.com/api/v3/touchpoint-types/' \
  --header 'app-token: TOTANGO_TOKEN'
  ```

* `TASK_ASSIGNEE`: **Required**, `string`

  When a task is created in Totango, this value will be the assignee for the task. Must be the email associated with Totango sign up (Totango user name). This value is also used as the submitter for a touchpoint.

* `GITHUB_TOKEN`: **Required**, `string`

  The Auto Generated GitHub Auth token for actions

  > Should be defaulted to secrets.GITHUB_TOKEN, it will be generated by actions at runtime

### Action Triggers

This action supports the following triggers:

* issues
  * closed
  * edited
  * labeled
* issue_comments
  * created

### Interacting with Issues

To use this action with a repository, a workflow configuration should be applied similar to the following:

```yaml
name: totango

on:
  issues:
    types: [closed, labeled, edited]
  issue_comment:
    types: [created]

jobs:
  totango-integration:
    # Prevent action from trying to parse issues that don't have a label which this action supports
    if: contains(github.event.issue.labels.*.name, 'task') ||
        contains(github.event.issue.labels.*.name, 'touchpoint')
    runs-on: ubuntu-latest
    steps:
      - name: Main run
        uses: jmassardo/issues-to-totango@VERSION
        with:
          ACCOUNT_ID: ${{ secrets.TOTANGO_ACCOUNT_ID }}
          APP_TOKEN: ${{ secrets.TOTANGO_APP_TOKEN }}
          ACTIVITY_TYPE: ${{ vars.TOTANGO_ACTIVITY_TYPE }}
          TOUCHPOINT_TAGS: ${{ vars.TOTANGO_TOUCHPOINT_TAGS }}
          TOUCHPOINT_TYPE: ${{ vars.TOTANGO_TOUCHPOINT_TYPE }}
          TASK_ASSIGNEE: ${{ vars.TOTANGO_TASK_ASSIGNEE }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

```

Issues with a `task` or `touchpoint` tag would be selected for usage with this action.

## Example Issue Templates

See example issue template files at [examples](./examples/)

* [Task Issue Template](./examples/task_issue_template_example.md)
* [Touchpoint Issue Template](./examples/touchpoint_issue_example.md)

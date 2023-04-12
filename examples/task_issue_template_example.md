# Issue Template Example

The below should be used exactly in an issue template and added into your repo at the following location:  .github/ISSUE_TEMPLATE/task_template_name.yml

## **IMPORTANT** 

If the below is not copied **exactly** as written, the regex used for parsing issue templates will break and defaults will be used for priority and due date for tasks. The entire issue will be copied into the description.

See this repo at .github/ISSUE_TEMPLATE/task.yml for an example of what this should look like in the repo where the action is being run

```yaml
name: Task Template
description: Submit an issue
title: "ISSUE TITLE - CHANGE ME"
labels: ["task"]
body:
  - type: markdown
    attributes:
      value: |
        Please use the below form to submit an issue.
  - type: textarea
    id: Description
    attributes:
      label: Description
      description: Describe the issue
      placeholder: Tell us what's up
    validations:
      required: true
  - type: dropdown
    id: priority
    attributes:
      label: Priority
      description: Low (3), Normal (2), or High (1) priority
      options:
        - 3
        - 2
        - 1
    validations:
      required: true
  - type: input
    id: date
    attributes:
      label: Due Date
      description: Please enter a due date for task completion in the form YYYY-MM-DD
      value: "YYYY-MM-DD"
    validations:
      required: true
```
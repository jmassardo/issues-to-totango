
const { totangoPrivate, } = require('../src/totango');
// import { context, } from '@actions/github';
// import { getOctokit, } from '@actions/github';
// import { request, } from 'request';
const github = require('@actions/github');
jest.mock('@actions/github');
const issue = github.context.payload.issue;
describe('comment_gh_issue', () => {
  let touchpoint_id = 'abc123098';
  it('should comment on a github issue', () => {
    const issue_number = issue['number'];
    const repo = 'repo';
    const owner = 'owner  ';
    const body = `ID: ${touchpoint_id}`;
    const context = {
      repo: {
        owner: owner,
        repo: repo,
      },
    };
    github.context = context;
    const octokit = {
      rest: {
        issues: {
          createComment: jest.fn(),
        },
      },
    };
    github.getOctokit = jest.fn().mockReturnValue(octokit);
    totangoPrivate.comment_gh_issue(touchpoint_id);
    expect(octokit.rest.issues.createComment).toHaveBeenCalledWith({
      owner: owner,
      repo: repo,
      issue_number: issue_number,
      body: body,
    });
  });
});

const index = require('../index.js');
const { comment_gh_issue, create_task, create_touchpoint } = index.i2tPrivate;

// Mock comment_gh_issue
jest.mock('../index.js');

describe('comment_gh_issue', () => {
  let touchpoint_id = 'abc123098';
  it('should comment on a github issue', () => {
    const issue_number = 1;
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
    comment_gh_issue(touchpoint_id);
    expect(octokit.rest.issues.createComment).toHaveBeenCalledWith({
      owner: owner,
      repo: repo,
      issue_number: issue_number,
      body: body,
    });
  });
});

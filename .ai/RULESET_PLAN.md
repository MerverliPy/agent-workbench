# Repository Ruleset Plan

## Target branch

main

## Required protections

- Require pull request before merge
- Require status checks before merge
- Block force push
- Block branch deletion
- Require conversation resolution
- Restrict direct pushes to main
- Require linear history if compatible with workflow

## Required status checks

- AI Safety Checks
- Repo Health
- CodeQL

## Rollout mode

1. Start in Evaluate mode if available.
2. Confirm no expected workflow is blocked.
3. Switch to Active mode.

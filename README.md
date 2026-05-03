# Lizzie

View multiple Azure DevOps boards (from multiple organizations) in a single consolidated view. Implemented as an Electron app

## Key decisions

| Decision                                       | Description                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Electron app                                   | This is a self-contained Electron app. No server component.                                                                                                                                                                                                                                                                                                             |
| Simple mapping file management                 | Can import/export board mapping file (JSON) to share between the team                                                                                                                                                                                                                                                                                                   |
| Security - store PAT locally                   | A PAT (personal application token, scoped to the user) is stored locally in the application configuration                                                                                                                                                                                                                                                               |
| Combined board view                            | Generate a view of the combined projects within the app - largely read-only. Can open a card and view the card's rendered Markdown file, similar to the AzDO view, and have a link to open the card in AzDO directly.                                                                                                                                                      |



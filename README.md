# Lizzie

Layer over AzDO for local management of cards using Markdown, implemented as an Electron app

I had an idea about a layer over Azure DevOps that let you manage cards using a local Markdown repository and sync back and forth between local and AzDO. The local repository can be opened in VS code etc and you could use AI tooling to work on the cards, then use the tool to update AzDO cards with the updated local repository.

Quinten and I had a conversation about being able to view a consolidated view of the board of multiple AzDO projects.

- AV has four projects, each with different column setups
- The tool would connect to each project
- Define columns in the consolidated view
- Define mappings from each project to the consolidated view
- Tools to filter in/out individual projects, card types

## Considerations/questions

- [ ] Conflict resolution

## Key decisions

| Decision                                       | Description                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AzDO card attachments                          | Don't sync these, manage in AzDO only                                                                                                                                                                                                                                                                                                                                   |
| No support for adding embedded images          | Don't support embedding images (syncing arbitrary files from local to AzDO) - AzDO stores embedded images internally. This could be revisited if we could upload an image directly to a project.                                                                                                                                                                        |
| One .md file per card                          | One Markdown file per AzDO card                                                                                                                                                                                                                                                                                                                                         |
| Structured .md files map to AzDO card sections | The Markdown files have second level headings. The application has mapping between AzDO card sections and the second level headings mappings. When syncing from local -> AzDO it takes the content from second level headings and uses the mappings to update the AzDO card. Similar for AzDO -> local. Any sections in the .md file that aren't mapped are left alone. |
| Electron app                                   | This is a self-contained Electron app. No server component.                                                                                                                                                                                                                                                                                                             |
| Simple mapping file management                 | Can import/export board mapping file (JSON) to share between the team                                                                                                                                                                                                                                                                                                   |
| Security - store PAT locally                   | A PAT (personal application token, scoped to the user) is stored locally in the application configuration                                                                                                                                                                                                                                                               |
| Combined board view                            | Generate a view of the combined projects within the app - largely static. Can open a card and view the card's rendered Markdown file, similar to the AzDO view, and have a link to open the card in AzDO directly.                                                                                                                                                      |



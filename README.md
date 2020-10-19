# GUIDO: Open Data Process Guide

GUIDO is a MVP that was created within a 12-week fellowship with Tech4Germany 2020. The team can be seen [further down](#team-and-project-partners) and the official project page can be found here: [tech.4germany.org/project/open-data-portal](https://tech.4germany.org/project/open-data-portal/). GUIDO is build to first help define the process of publishing open data in a ministry and then guide federal employees through the process of doing so. This Readme will naturally focus on its software architecture and deployment steps. On the project page there are various further documents going in depth regarding its purpose, how it all came about and what steps would have to be taken to deploy GUIDO for actual usage.

## Environment and Frameworks

web part
lists, documents, user mgmt
SharePoint & React

## Software architecture

To satisfy the requirement of maximum flexibility in designing the open-data-publishing processes, the central piece that all definitions stem from is the `config.json` file in `src/webparts/guido/model`. Here, processes are described as an ordered series of module IDs. These modules are each described as an ordered series of fields that have different types - string renders as textfield, boolean renders as checkbox etc. Some fields are optional wheras others are mandatory. Once a new process of publishing open data is started (instantiated) we call it a case ("Bereitstellung") consisting of instantiated modules called tasks.

The users sees always one task at a time, consisting of fields to fill out in the style of a form. Next to each field is an info-icon providing more info, also sourced from the JSON file. Some tasks have roles assigned that are reponsible for them. If a users reaches such a task, it can either be claimed to do now or to notify the responsible role. That triggers an email containing a link that leads to only this task of the overall case. By utilizing [Power Automate](#power-automate), GUIDO supports the workflow of receieving files via email. The sender gets an email back containing a link that lets them start a new case with these files already included.

Since being a web part on a SharePoint does not come with the option to choose own URL routing (e.g. `/dashboard`), we use URL-encoded parameter to signalize specific entry points to the application.f This happens in two cases:

- The `startCaseByEmail`-key signalizes to GUIDO that a new case should be started from the default process and the value is the SharePoint documents folder containing the files already uploaded via email
- The combination of `caseId` and `step` signalizes that an external responsible role has come to work on only one specific task

If data of ongoing cases and of uploaded files is persisted depends on the environment GUIDO is running in. If its the local workbench, no data storage/retrieval happens. If deployed in a SharePoint it does happen by utilizing *Lists* and *Documents*.

## Power Automate

TODO

## Deployment in SharePoint

yo @microsoft/sharepoint

SharePoint Online only (latest)

For deploying the web part in a SharePoint environment, we signed up for an online-version offered by Microsoft: "Microsoft 365 Business Standard" (Für Unternehmen) on [this](https://www.microsoft.com/de-de/microsoft-365/business/compare-all-microsoft-365-business-products?tab=2&market=de) site (10,5€ user/month after a 1-month trial).

### Steps taken after setting the above up:

- If multi-factor authentication is on by default, it can be turned off (to make guest-user logins easier) in the "Azure Active Directory admin center" > Dashboard > Properties ([direct link](https://aad.portal.azure.com/#blade/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/Properties)) > at the bottom click on "Manage Security defaults" and then move the slider to "No".

- Create an "App Catalog" site to deploy the web part to your SharePoint following [these instructions](https://docs.microsoft.com/en-us/sharepoint/use-app-catalog).

- Deploy this web part into that App Catalog following [these instructions](https://docs.microsoft.com/en-us/sharepoint/dev/spfx/web-parts/get-started/hosting-webpart-from-office-365-cdn).

- Add it to a site.

- To set the permissions for sharing files and folders from SharePoint to "anyone with the link" (= no login required, by default this is not allowed), follow the [instructions here](https://docs.microsoft.com/en-US/sharepoint/change-external-sharing-site).

- To allow emailing users within the organization via *PnPjs*, they need to be members of the SharePoint page in question. For that, add the respective emails at `<SharePoint_Page>/_layouts/15/people.aspx?MembershipGroupId=5`, in our case that is [this link](https://opendataprocess.sharepoint.com/sites/Guido/_layouts/15/people.aspx?MembershipGroupId=5).

### Degrees of Deployment

TODO

Add `_layouts/workbench.aspx` to your SharePoint site URL.

## Setup

The skeleton for the web part was created using `yo @microsoft/sharepoint`, following the tutorial [here](point/dev/spfx/web-parts/get-started/build-a-hello-world-web-part). More info in the respective [commit message](https://github.com/tech4germany/open-data-process-guide/commit/d3f418f64628d94720e3f6f8749c4c67d72d0eb3).

```sh
# node v10.13.0
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | bash
source ~/.bashrc
nvm install 10.13.0
nvm use v10.13.0

npm install gulp --global
npm install
```

## Run

```sh
gulp serve
```

## Build

```sh
gulp bundle --ship # ignore the "build failed" message at the end, that's a bug and not true
gulp package-solution --ship 
```

---

<details>

<summary>fold out example</summary>

Cool right?! :sunglasses:

</details>

# Team and project partners

We are the Team **Open Data Portal** of the [2020 Tech4Germany fellowship](https://tech.4germany.org/fellowship-2020/) (from left to right):
- [Tjorven Rohwer](https://www.linkedin.com/in/tjorvenrohwer/)
- [Nele Lüpkes](https://www.linkedin.com/in/nelel%C3%BCpkes/), [@SplitSeconds](https://github.com/SplitSeconds)
- [Daniela Vogel](https://www.linkedin.com/in/daniela-vogel/), [@Dangerousdani](https://github.com/Dangerousdani)
- [Benjamin Degenhart](https://www.linkedin.com/in/bdegenhart/), [@benjaminaaron](https://github.com/benjaminaaron)

<img src="https://user-images.githubusercontent.com/5141792/93686296-98ee4c80-fab5-11ea-877d-9ecf9dfbb2f7.jpg">

Alongside Tech4Germany, our project partners were **Jemila Kehinde** and **Jens Schüring** from the Federal Foreign Office and **Christian Horn**, **Antje Göldner** and **Christian Wittig** from GovData.

<table><tr><td>
<img src="https://user-images.githubusercontent.com/5141792/96272478-6cebbb80-0fce-11eb-91d3-d4e02af8fe6b.png"" width="200" ></td>
<td>
<img src="https://user-images.githubusercontent.com/5141792/96272475-6bba8e80-0fce-11eb-8d58-0bfc705f30da.png" width="200" ></td>
<td>
<img src="https://user-images.githubusercontent.com/5141792/96272480-6cebbb80-0fce-11eb-9924-fdb45ecd9a8f.png" width="200" ></td></tr></table>


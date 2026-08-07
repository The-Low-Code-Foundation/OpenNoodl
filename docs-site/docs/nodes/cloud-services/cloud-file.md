---
title: "Cloud File"
---
Unwraps a cloudfile value into its name and URL, for display or download links.

Cloud File takes a `cloudfile`-typed value — produced by Upload File or stored on a record's file property — and exposes its `name` and `url` as strings. It performs no requests; it is a value adapter between the opaque cloud-file handle and the string-typed inputs the UI actually wants (an Image `src`, a link, a caption).

## When to use it

Whenever a file handle needs to become a URL or filename. Note the cloudfile→image typecast lets a cloudfile feed an Image `src` directly; reach for Cloud File when you need the URL as a *string* or the file's name.

## At a glance

| | |
|---|---|
| Category | Cloud Services |
| Type name | `Cloud File` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `file` | Cloudfile | — | Stored file to read, as an Upload File node or a record property produces it; any other value leaves the previous file in place |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `contentType` | String | — | MIME type the backend recorded on upload; empty on a backend that does not report one, and on a file read back from a record property |
| `name` | String | — | Original file name as it was uploaded, without the storage prefix |
| `size` | Number | — | Size in bytes the backend recorded on upload; empty on a backend that does not report one, and on a file read back from a record property |
| `url` | String | — | Address the file can be fetched from; a private file needs a Sign File URL node before this link works |

## Examples

**Create a record with an uploaded file attachment**

The create-with-attachment flow: Open File Picker hands the picked browser file to Upload File, which stores it in cloud storage and outputs a `cloudFile`. Cloud File exposes that file's `url`, previewed in an Image (the cloudfile→image cast). When the upload succeeds, Create Record (NewDbModelProperties) writes a new 'Attachment' record whose properties — including the file — are set on the node's schema-generated inputs.

## Related nodes

[Upload File](./upload-file.md), [Image](../visual/image.md), [External Link](../navigation/net-noodl-externallink.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::

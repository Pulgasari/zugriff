# commands

eine **app** oder ein **tool** kann commands registrieren, die dann in der `zugriff/cli` benutzt werden können.

```javascript
app.cli.commands = {
  'list-podcasts' : () => app.lib.podcasts,
};
```

```sh
zugriff/podcasts list-podcasts
```

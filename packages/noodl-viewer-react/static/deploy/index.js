window.__noodl_modules = [];
window.Noodl = {
    defineModule:function(m) {
        // CN-003: adopt the manifest name the injector set just before this
        // kit's script. Must happen here, not in `registerModule` — see the
        // viewer's copy of this bootstrap for why.
        if (m && !m.name && window.__noodl_module_name) m.name = window.__noodl_module_name;
        window.__noodl_modules.push(m);
    },
    deployed: true,
    Env: {}
}

window.projectData = {{#export#}};

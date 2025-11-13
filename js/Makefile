dev: package.json
	cp -f webpack.config.js.dev webpack.config.js
	npm run build

prod: package.json
	cp -f webpack.config.js.prod webpack.config.js
	npm run build

package.json:
	which npm >& /dev/null || { echo "Install Node.js before continuing"; exit 1; }
	npm init -y || { rm -fr node_modules package-lock.json package.json; exit 1; }
	# FIXME Ugly specific workaround for EDF security policy
ifneq (,	$(findstring edf.fr,$(http_proxy)))
	npm config set registry https://si-devops-mirror.edf.fr/repository/registry.npmjs.org/
	npm config set noproxy si-devops-mirror.edf.fr
endif
	npm install --save marked marked-gfm-heading-id || { rm -fr node_modules package-lock.json package.json; exit 1; }
	npm install --save bootstrap @popperjs/core || { rm -fr node_modules package-lock.json package.json; exit 1; }
	npm install --save-dev webpack webpack-cli || { rm -fr node_modules package-lock.json package.json; exit 1; }
	npm install --save-dev autoprefixer css-loader postcss-loader sass sass-loader style-loader || { rm -fr node_modules package-lock.json package.json; exit 1; }
	npm install --save-dev eslint-config-airbnb-base eslint eslint-plugin-import  eslint-webpack-plugin || { rm -fr node_modules package-lock.json package.json; exit 1; }
	sed -i -e 's/\("scripts": {\)/\1\n    "build": "webpack",/' package.json
	sed -i -e 's/"main":.*/"private": true,/' package.json
	sed -i -e 's/"name":.*/"name": "dsas",/' package.json

clean:
	rm -fr dist webpack.config.js

realclean : clean
	rm -fr node_modules package-lock.json package.json

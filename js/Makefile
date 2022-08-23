dev: package.json
	cp -f webpack.config.js.dev webpack.config.js
	npm run build

prod: package.json
	cp -f webpack.config.js.prod webpack.config.js
	npm run build

package.json:
	which npm >& /dev/null || { echo "Install Node.js before continuing"; exit 1; }
	npm init -y || { rm -fr node_modules package-lock.json package.json; exit 1; }
	npm install --save marked bootstrap || { rm -fr node_modules package-lock.json package.json; exit 1; }
	npm install --save-dev webpack webpack-cli eslint eslint-webpack-plugin style-loader css-loader || { rm -fr node_modules package-lock.json package.json; exit 1; }
	# FIXME Ignore error "Exit handler never called" during install of module install-peerdeps. It'll still work
	npm install --save-dev install-peerdeps || true
	npx install-peerdeps --dev eslint-config-airbnb-base || { rm -fr node_modules package-lock.json package.json; exit 1; }
	sed -i -e 's/\("scripts": {\)/\1\n    "build": "webpack",/' package.json
	sed -i -e 's/"main":.*/"private": true,/' package.json
	sed -i -e 's/"name":.*/"name": "dsas",/' package.json

clean:
	rm -fr dist webpack.config.js

realclean : clean
	rm -fr node_modules package-lock.json package.json

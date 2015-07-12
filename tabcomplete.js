$.widget("cbenni.tabcomplete", {
	options: {
		collection: [],
	},
	_create: function() 
	{
		this.textsplit = ["", "", ""];
		this.tabtries = -1;
		var self = this;
		this.element.bind("click focus", function() {
			self.tabtries = -1;
		});
		
		this.element.keydown(function(plugin){return function(e) {
			var code = e.keyCode || e.which;
			if (code == 9) { // tab pressed
				e.preventDefault();
				// if this is the first time tab is pressed here, we split the text before and after the word
				if (plugin.tabtries == -1) {
					var caretpos = $(this).caret();
					var text = $(this).val()||$(this).text();
					var start = (/\w+$/.exec(text.substr(0, caretpos)) || {index: caretpos}).index;
					var end = caretpos + (/^\w+/.exec(text.substr(caretpos)) || [""])[0].length;
					plugin.textsplit = [text.substring(0, start), text.substring(start, end), text.substring(end + 1)];
				}
				// calculate the collection of strings actually eligible for suggestion, either by filtering or by executing the function specified
				var collection = plugin.options.collection || [];
				if(typeof collection === "object")
				{
					collection = collection.filter(function(v){
						return v.toLowerCase().indexOf(plugin.textsplit[1].toLowerCase())==0;
					});
				}
				else if (typeof collection == "function") 
					collection = collection(plugin.textsplit[1]);
				// collection now (hopefully) is a list of values
				if (collection.length > 0) {
					// shift key iterates backwards
					plugin.tabtries += e.shiftKey?-1:1;
					if(plugin.tabtries >= collection.length) plugin.tabtries = 0;
					if(plugin.tabtries < 0) plugin.tabtries = collection.length+plugin.tabtries;
					$(this).val(plugin.textsplit[0] + collection[plugin.tabtries] + plugin.textsplit[2]);
					$(this).text(plugin.textsplit[0] + collection[plugin.tabtries] + plugin.textsplit[2]);
					$(this).caret(plugin.textsplit[0].length + collection[plugin.tabtries].length);
				}
			}
			// escape
			else if(code == 27 && plugin.tabtries>=0)
			{
				$(this).val(plugin.textsplit[0] + plugin.textsplit[1] + plugin.textsplit[2]);
				$(this).text(plugin.textsplit[0] + plugin.textsplit[1] + plugin.textsplit[2]);
			}
			// not shift
			else if(code != 16)
			{
				plugin.tabtries = -1;
			}
		}}(this));
	}
});

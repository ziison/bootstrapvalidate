# 验证插件说明文档

## 说明

BootstrapValidator是一款功能非常强大的基于Bootstrap的jQuery表单验证插件。因为插件本身依赖了bootstrap，所以在使用的过程中还必须引入不是很必要的bootstrap.js和bootstrap.css，这样就显得十分冗余，所以我把插件进行了大量的精简，去掉了bootstrap的依赖的同时也删除了大量的不常用的验证规则，同时把默认语言由英文改为中文。

该表单验证插件的可用验证器有：

* `callback`：通过回调函数返回验证信息。
* `digits`：如果输入的值只包含数字返回true。
* `emailAddress`：验证电子邮件格式是否有效。
* `phone`：验证手机号码格式是否有效。
* `identical`：验证输入的值是否和指定字段的值相同。
* `notEmpty`：检测字段是否为空。
* `regexp`：检测输入值是否和指定的javascript正则表达式匹配。
* `remote`：通过AJAX请求来执行远程代码。
* `stringLength`：验证字符串的长度。
* `uri`：验证URL地址是否有效。

## 使用方法

使用这个表单验证插件首先要引入必要的js和css文件。jQuery要求1.9.1+以上的版本。

CSS
```css 
.has-feedback {
    position: relative
}
.has-success .help-block {
    color: #3c763d
}

.has-success .focus input {
    border-color: #3c763d;
    -webkit-box-shadow: inset 0 1px 1px rgba(0,0,0,.075);
    box-shadow: inset 0 1px 1px rgba(0,0,0,.075)
}


.has-success .form-control-feedback {
    color: #3c763d
}

.has-error .help-block {
    color: #a94442
}

.has-error .focus input {
    border-color: #a94442;
    -webkit-box-shadow: inset 0 1px 1px rgba(0,0,0,.075);
    box-shadow: inset 0 1px 1px rgba(0,0,0,.075)
}
```
JS
```html 
<script src="js/jquery.min.js"></script>
<script src="js/bootstrapValidator.js"></script>
```
HTML结构
```html 
<form id="form1" method="post">
  <div class="form-item">
    <label class="form-label">用户名</label>
    <div class="form-con">
      <input type="text" class="form-control" name="username" />
    </div>
  </div>
  <div class="form-item">
    <label class="form-label">电子邮箱</label>
    <div class="form-con">
      <input type="text" class="form-control" name="email" />
    </div>
  </div>
  <div class="form-item">
    <label class="form-label">密码</label>
    <div class="form-con">
      <input type="password" class="form-control" name="password" />
    </div>
  </div>
  <div class="form-item">
    <label class="form-label">确认密码</label>
    <div class="form-con">
      <input type="password" class="form-control" name="confirmPassword" />
    </div>
  </div>
  <div class="form-item">
    <label class="form-label">验证码</label>
    <div class="form-con">
      <input type="text" class="form-control" name="captcha" />
    </div>
  </div>
  <div class="form-item">
    <div class="form-con">
      <button type="submit" class="btn btn-primary">注册</button>
    </div>
  </div>
</form>
```
在页面加载完毕之后，通过下面的方法来初始化该表单验证插件：
```html 
<script type="text/javascript">
  $(document).ready(function() {
	$('#form1').bootstrapValidator({

		//关键配置：最小单元
		group: ".form-item",
		
		//关键配置：提交按钮
		submitButtons: '[type="submit"]',

    	fields: {
	      	username: {
		      	message: '请输入一个有效值',
		      	validators: {
			      	notEmpty: {
			      		message: '用户名不能为空'
	      			},
	      			stringLength: {
			      		min: 6,
			      		max: 30,
			      		message: '用户名长度必须介于6至30个字符之间'
			    	},
	      			regexp: {
				        regexp: /^[a-zA-Z0-9_]+$/,
				        message: '用户名只能包含数字，字母和下划线'
				    }
		      	}
	    	},
		    email: {
		      	validators: {
			        notEmpty: {
			          	message: '电子邮箱不能为空'
			        },
			        emailAddress: {
			          	message: '电子邮箱格式不正确'
			        }
		      	}
		    },
    		password: {
			    validators: {
			      	notEmpty: {
			          	message: '密码不能为空'
			        }
			    }
			},
		    confirmPassword: {
		      	validators: {
		        	notEmpty: {
		        		message: '密码不能为空'
		        	},
		        	identical: {
			        	field: 'password',
			        	message: '前后密码必须一致'
			        }
		    	}
		    },
		    captcha: {
                validators: {
                    notEmpty: {
                        message: '验证码不能为空'
                    }
                    callback: {
                        message: '验证码不正确',
                        callback: function(value, validator) {
                            var value = $('#captcha').val(), 
                            code = "abcd";
                            return value == code;
                        }
                    }
                }
            }
  		}
  	});
});
</script>
```
